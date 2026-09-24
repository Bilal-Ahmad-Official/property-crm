import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { buybackData } from "@/lib/forms";
import { canApprove, canSubmit, TXN_DECIDABLE_FROM, TXN_EDITABLE_STATUSES, TXN_SUBMITTABLE_FROM } from "@/lib/approval";

const ENTITY = "BUYBACK";
type Ctx = { params: Promise<{ id: string }> };

async function loadBuyBack(id: string) {
  return db.buyBack.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, ref: true, email: true, phone: true } },
      property: { select: { id: true, title: true, ref: true, status: true, city: true } },
      createdBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const buyback = await loadBuyBack(id);
    if (!buyback) return jsonError("Buy-back not found", 404);

    const history = await db.statusHistory.findMany({
      where: { entityType: ENTITY, entityId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({
      buyback,
      history: history.map((h) => ({ ...h, user: h.user?.name ?? null })),
    });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.buyBack.findUnique({ where: { id } });
    if (!existing) return jsonError("Buy-back not found", 404);

    // SRS §6: completed or approved records have edit restrictions
    if (!TXN_EDITABLE_STATUSES.includes(existing.status)) {
      return jsonError(`Buy-back ${existing.ref} is ${existing.status.toLowerCase()} and locked for editing`, 403);
    }

    const buyback = await db.$transaction(async (tx) => {
      const updated = await tx.buyBack.update({
        where: { id },
        data: buybackData(body, false) as Prisma.BuyBackUncheckedUpdateInput,
      });
      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: existing.ref,
          action: "UPDATED",
          fromStatus: existing.status,
          toStatus: updated.status,
          note: "Buy-back details updated",
          userId: user.id,
        },
      });
      return updated;
    });
    return NextResponse.json({ buyback });
  });
}

// Lifecycle actions (SRS §4/§8): submit | start_review | approve | reject | return | cancel
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || "");
    const reason = body.reason ? String(body.reason).trim() : "";

    const buyback = await db.buyBack.findUnique({
      where: { id },
      include: { property: { select: { id: true, title: true, ref: true, status: true } } },
    });
    if (!buyback) return jsonError("Buy-back not found", 404);

    const isCreator = buyback.createdById === user.id;
    // Buy-backs are admin-approved (SRS §8 approval matrix)
    const approver = canApprove(ENTITY, user.role);
    let nextStatus = "";
    const historyNote = reason || null;

    switch (action) {
      case "submit": {
        if (!TXN_SUBMITTABLE_FROM.includes(buyback.status)) {
          return jsonError(`Cannot submit a buy-back in ${buyback.status.toLowerCase()} status`, 400);
        }
        if (!canSubmit(ENTITY, user.role) && !isCreator) {
          return jsonError("You do not have permission to submit this buy-back", 403);
        }
        if (buyback.buybackAmount <= 0) return jsonError("Buy-back amount must be greater than zero before submission", 400);
        nextStatus = "SUBMITTED";
        break;
      }
      case "start_review": {
        if (buyback.status !== "SUBMITTED") return jsonError("Only submitted buy-backs can move to review", 400);
        if (!approver) return jsonError("Only administrators can review buy-backs", 403);
        nextStatus = "UNDER_REVIEW";
        break;
      }
      case "approve": {
        if (!TXN_DECIDABLE_FROM.includes(buyback.status)) {
          return jsonError(`Cannot approve a buy-back in ${buyback.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only administrators can approve buy-backs", 403);
        nextStatus = "APPROVED";
        break;
      }
      case "reject": {
        if (!TXN_DECIDABLE_FROM.includes(buyback.status)) {
          return jsonError(`Cannot reject a buy-back in ${buyback.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only administrators can reject buy-backs", 403);
        if (!reason) return jsonError("A rejection reason is required", 400);
        nextStatus = "REJECTED";
        break;
      }
      case "return": {
        if (!TXN_DECIDABLE_FROM.includes(buyback.status)) {
          return jsonError(`Cannot return a buy-back in ${buyback.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only administrators can return buy-backs", 403);
        if (!reason) return jsonError("A reason is required to return a buy-back", 400);
        nextStatus = "RETURNED";
        break;
      }
      case "cancel": {
        if (!["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(buyback.status)) {
          return jsonError(`Cannot cancel a buy-back in ${buyback.status.toLowerCase()} status`, 400);
        }
        if (!isCreator && user.role !== "ADMIN") {
          return jsonError("Only the creator or an administrator can cancel this buy-back", 403);
        }
        nextStatus = "CANCELLED";
        break;
      }
      default:
        return jsonError("Unknown action", 400);
    }

    const updated = await db.$transaction(async (tx) => {
      const data: Prisma.BuyBackUncheckedUpdateInput = { status: nextStatus };
      if (action === "submit") data.submittedAt = new Date();
      if (["approve", "reject", "return", "start_review"].includes(action)) {
        data.reviewedById = user.id;
        data.reviewedAt = new Date();
        data.reviewNote = historyNote;
      }
      const result = await tx.buyBack.update({ where: { id }, data });

      // Side effects: approving a buy-back returns the property to inventory (SRS §4 lifecycle)
      if (action === "approve" && buyback.property.status === "SOLD") {
        await tx.property.update({
          where: { id: buyback.property.id },
          data: { status: "AVAILABLE" },
        });
        await tx.statusHistory.create({
          data: {
            entityType: "PROPERTY",
            entityId: buyback.property.id,
            entityRef: buyback.property.ref ?? null,
            action: "STATUS_CHANGE",
            fromStatus: "SOLD",
            toStatus: "AVAILABLE",
            note: `Returned to inventory by approved buy-back ${buyback.ref}`,
            userId: user.id,
          },
        });
      }

      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: buyback.ref,
          action: action.toUpperCase(),
          fromStatus: buyback.status,
          toStatus: nextStatus,
          note: historyNote,
          userId: user.id,
        },
      });
      await tx.activity.create({
        data: {
          type: "STATUS_CHANGE",
          content: `Buy-back **${buyback.ref}** ${action.replace("_", " ")}${reason ? ` — ${reason}` : ""}`,
          entityType: ENTITY,
          entityId: id,
          propertyId: buyback.propertyId,
          userId: user.id,
        },
      });
      return result;
    });

    return NextResponse.json({ buyback: updated });
  });
}
