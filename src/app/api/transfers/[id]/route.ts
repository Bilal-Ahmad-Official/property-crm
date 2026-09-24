import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { transferData } from "@/lib/forms";
import { canApprove, canSubmit, TXN_DECIDABLE_FROM, TXN_EDITABLE_STATUSES, TXN_SUBMITTABLE_FROM } from "@/lib/approval";

const ENTITY = "TRANSFER";
type Ctx = { params: Promise<{ id: string }> };

async function loadTransfer(id: string) {
  return db.propertyTransfer.findUnique({
    where: { id },
    include: {
      fromCustomer: { select: { id: true, name: true, ref: true, email: true, phone: true } },
      toCustomer: { select: { id: true, name: true, ref: true, email: true, phone: true } },
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
    const transfer = await loadTransfer(id);
    if (!transfer) return jsonError("Transfer not found", 404);

    const history = await db.statusHistory.findMany({
      where: { entityType: ENTITY, entityId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({
      transfer,
      history: history.map((h) => ({ ...h, user: h.user?.name ?? null })),
    });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.propertyTransfer.findUnique({ where: { id } });
    if (!existing) return jsonError("Transfer not found", 404);

    // SRS §6: completed or approved records have edit restrictions
    if (!TXN_EDITABLE_STATUSES.includes(existing.status)) {
      return jsonError(`Transfer ${existing.ref} is ${existing.status.toLowerCase()} and locked for editing`, 403);
    }

    const transfer = await db.$transaction(async (tx) => {
      const updated = await tx.propertyTransfer.update({
        where: { id },
        data: transferData(body, false) as Prisma.PropertyTransferUncheckedUpdateInput,
      });
      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: existing.ref,
          action: "UPDATED",
          fromStatus: existing.status,
          toStatus: updated.status,
          note: "Transfer details updated",
          userId: user.id,
        },
      });
      return updated;
    });
    return NextResponse.json({ transfer });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.propertyTransfer.findUnique({ where: { id } });
    if (!existing) return jsonError("Transfer not found", 404);
    if (user.role !== "ADMIN") return jsonError("Only administrators can delete transfers", 403);
    if (!["DRAFT", "REJECTED", "CANCELLED"].includes(existing.status)) {
      return jsonError("Submitted, approved and completed transfers cannot be deleted", 403);
    }
    await db.$transaction(async (tx) => {
      await tx.payment.updateMany({ where: { relatedType: ENTITY, relatedId: id }, data: { relatedType: null, relatedId: null, relatedRef: null } });
      await tx.statusHistory.deleteMany({ where: { entityType: ENTITY, entityId: id } });
      await tx.activity.deleteMany({ where: { entityType: ENTITY, entityId: id } });
      await tx.propertyTransfer.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
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

    const transfer = await db.propertyTransfer.findUnique({ where: { id } });
    if (!transfer) return jsonError("Transfer not found", 404);

    const isCreator = transfer.createdById === user.id;
    const approver = canApprove(ENTITY, user.role);
    let nextStatus = "";
    const historyNote = reason || null;

    switch (action) {
      case "submit": {
        if (!TXN_SUBMITTABLE_FROM.includes(transfer.status)) {
          return jsonError(`Cannot submit a transfer in ${transfer.status.toLowerCase()} status`, 400);
        }
        if (!canSubmit(ENTITY, user.role) && !isCreator) {
          return jsonError("You do not have permission to submit this transfer", 403);
        }
        nextStatus = "SUBMITTED";
        break;
      }
      case "start_review": {
        if (transfer.status !== "SUBMITTED") return jsonError("Only submitted transfers can move to review", 400);
        if (!approver) return jsonError("Only managers and administrators can review transfers", 403);
        nextStatus = "UNDER_REVIEW";
        break;
      }
      case "approve": {
        if (!TXN_DECIDABLE_FROM.includes(transfer.status)) {
          return jsonError(`Cannot approve a transfer in ${transfer.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only managers and administrators can approve transfers", 403);
        nextStatus = "APPROVED";
        break;
      }
      case "reject": {
        if (!TXN_DECIDABLE_FROM.includes(transfer.status)) {
          return jsonError(`Cannot reject a transfer in ${transfer.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only managers and administrators can reject transfers", 403);
        if (!reason) return jsonError("A rejection reason is required", 400);
        nextStatus = "REJECTED";
        break;
      }
      case "return": {
        if (!TXN_DECIDABLE_FROM.includes(transfer.status)) {
          return jsonError(`Cannot return a transfer in ${transfer.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only managers and administrators can return transfers", 403);
        if (!reason) return jsonError("A reason is required to return a transfer", 400);
        nextStatus = "RETURNED";
        break;
      }
      case "cancel": {
        if (!["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(transfer.status)) {
          return jsonError(`Cannot cancel a transfer in ${transfer.status.toLowerCase()} status`, 400);
        }
        if (!isCreator && user.role !== "ADMIN") {
          return jsonError("Only the creator or an administrator can cancel this transfer", 403);
        }
        nextStatus = "CANCELLED";
        break;
      }
      default:
        return jsonError("Unknown action", 400);
    }

    const updated = await db.$transaction(async (tx) => {
      const data: Prisma.PropertyTransferUncheckedUpdateInput = { status: nextStatus };
      if (action === "submit") data.submittedAt = new Date();
      if (["approve", "reject", "return", "start_review"].includes(action)) {
        data.reviewedById = user.id;
        data.reviewedAt = new Date();
        data.reviewNote = historyNote;
      }
      const result = await tx.propertyTransfer.update({ where: { id }, data });

      // No property mutation on approve — the schema stores no customer-ownership field
      // on Property, so the transfer record itself is the ownership evidence; the
      // activity entry below links the property so the trail shows on its feed.

      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: transfer.ref,
          action: action.toUpperCase(),
          fromStatus: transfer.status,
          toStatus: nextStatus,
          note: historyNote,
          userId: user.id,
        },
      });
      await tx.activity.create({
        data: {
          type: "STATUS_CHANGE",
          content: `Property transfer **${transfer.ref}** ${action.replace("_", " ")}${reason ? ` — ${reason}` : ""}`,
          entityType: ENTITY,
          entityId: id,
          propertyId: transfer.propertyId,
          userId: user.id,
        },
      });
      return result;
    });

    return NextResponse.json({ transfer: updated });
  });
}
