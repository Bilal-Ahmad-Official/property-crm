import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { purchaseData } from "@/lib/forms";
import { canApprove, canSubmit, TXN_DECIDABLE_FROM, TXN_EDITABLE_STATUSES, TXN_SUBMITTABLE_FROM } from "@/lib/approval";

const ENTITY = "PURCHASE";
type Ctx = { params: Promise<{ id: string }> };

async function loadPurchase(id: string) {
  return db.purchase.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, name: true, ref: true, email: true, phone: true } },
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
    const purchase = await loadPurchase(id);
    if (!purchase) return jsonError("Purchase not found", 404);

    const history = await db.statusHistory.findMany({
      where: { entityType: ENTITY, entityId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({
      purchase,
      history: history.map((h) => ({ ...h, user: h.user?.name ?? null })),
    });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.purchase.findUnique({ where: { id } });
    if (!existing) return jsonError("Purchase not found", 404);

    // SRS §6: completed or approved records have edit restrictions
    if (!TXN_EDITABLE_STATUSES.includes(existing.status)) {
      return jsonError(`Purchase ${existing.ref} is ${existing.status.toLowerCase()} and locked for editing`, 403);
    }

    const purchase = await db.$transaction(async (tx) => {
      const updated = await tx.purchase.update({
        where: { id },
        data: purchaseData(body, false) as Prisma.PurchaseUncheckedUpdateInput,
      });
      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: existing.ref,
          action: "UPDATED",
          fromStatus: existing.status,
          toStatus: updated.status,
          note: "Purchase details updated",
          userId: user.id,
        },
      });
      return updated;
    });
    return NextResponse.json({ purchase });
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

    const purchase = await db.purchase.findUnique({ where: { id } });
    if (!purchase) return jsonError("Purchase not found", 404);

    const isCreator = purchase.createdById === user.id;
    const approver = canApprove(ENTITY, user.role);
    let nextStatus = "";
    const historyNote = reason || null;

    switch (action) {
      case "submit": {
        if (!TXN_SUBMITTABLE_FROM.includes(purchase.status)) {
          return jsonError(`Cannot submit a purchase in ${purchase.status.toLowerCase()} status`, 400);
        }
        if (!canSubmit(ENTITY, user.role) && !isCreator) {
          return jsonError("You do not have permission to submit this purchase", 403);
        }
        if (purchase.purchaseAmount <= 0) return jsonError("Purchase amount must be greater than zero before submission", 400);
        nextStatus = "SUBMITTED";
        break;
      }
      case "start_review": {
        if (purchase.status !== "SUBMITTED") return jsonError("Only submitted purchases can move to review", 400);
        if (!approver) return jsonError("Only managers and administrators can review purchases", 403);
        nextStatus = "UNDER_REVIEW";
        break;
      }
      case "approve": {
        if (!TXN_DECIDABLE_FROM.includes(purchase.status)) {
          return jsonError(`Cannot approve a purchase in ${purchase.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only managers and administrators can approve purchases", 403);
        nextStatus = "APPROVED";
        break;
      }
      case "reject": {
        if (!TXN_DECIDABLE_FROM.includes(purchase.status)) {
          return jsonError(`Cannot reject a purchase in ${purchase.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only managers and administrators can reject purchases", 403);
        if (!reason) return jsonError("A rejection reason is required", 400);
        nextStatus = "REJECTED";
        break;
      }
      case "return": {
        if (!TXN_DECIDABLE_FROM.includes(purchase.status)) {
          return jsonError(`Cannot return a purchase in ${purchase.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only managers and administrators can return purchases", 403);
        if (!reason) return jsonError("A reason is required to return a purchase", 400);
        nextStatus = "RETURNED";
        break;
      }
      case "cancel": {
        if (!["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(purchase.status)) {
          return jsonError(`Cannot cancel a purchase in ${purchase.status.toLowerCase()} status`, 400);
        }
        if (!isCreator && user.role !== "ADMIN") {
          return jsonError("Only the creator or an administrator can cancel this purchase", 403);
        }
        nextStatus = "CANCELLED";
        break;
      }
      default:
        return jsonError("Unknown action", 400);
    }

    const updated = await db.$transaction(async (tx) => {
      const data: Prisma.PurchaseUncheckedUpdateInput = { status: nextStatus };
      if (action === "submit") data.submittedAt = new Date();
      if (["approve", "reject", "return", "start_review"].includes(action)) {
        data.reviewedById = user.id;
        data.reviewedAt = new Date();
        data.reviewNote = historyNote;
      }
      const result = await tx.purchase.update({ where: { id }, data });

      // No side effect on approve: the schema has no vendor-ownership field on Property
      // (ownership changes flow through PropertyTransfer), so record history only

      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: purchase.ref,
          action: action.toUpperCase(),
          fromStatus: purchase.status,
          toStatus: nextStatus,
          note: historyNote,
          userId: user.id,
        },
      });
      await tx.activity.create({
        data: {
          type: "STATUS_CHANGE",
          content: `Purchase **${purchase.ref}** ${action.replace("_", " ")}${reason ? ` — ${reason}` : ""}`,
          entityType: ENTITY,
          entityId: id,
          propertyId: purchase.propertyId,
          userId: user.id,
        },
      });
      return result;
    });

    return NextResponse.json({ purchase: updated });
  });
}
