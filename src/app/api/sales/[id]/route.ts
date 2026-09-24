import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { saleData } from "@/lib/forms";
import { canApprove, canSubmit, TXN_DECIDABLE_FROM, TXN_EDITABLE_STATUSES, TXN_SUBMITTABLE_FROM } from "@/lib/approval";

const ENTITY = "SALE";
type Ctx = { params: Promise<{ id: string }> };

async function loadSale(id: string) {
  return db.sale.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, ref: true, email: true, phone: true } },
      property: { select: { id: true, title: true, ref: true, status: true, city: true } },
      createdBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      agent: { select: { id: true, name: true } },
    },
  });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const sale = await loadSale(id);
    if (!sale) return jsonError("Sale not found", 404);

    const history = await db.statusHistory.findMany({
      where: { entityType: ENTITY, entityId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({
      sale,
      history: history.map((h) => ({ ...h, user: h.user?.name ?? null })),
    });
  });
}

// Field edits (SRS §6) and lifecycle actions (SRS §4/§8): submit | start_review | approve | reject | return | cancel
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;

    // Lifecycle action mode: the body carries an { action } and follows the shared lifecycle guards
    const action = body.action ? String(body.action) : "";
    if (action) {
      const reason = body.reason ? String(body.reason).trim() : "";
      const sale = await db.sale.findUnique({
        where: { id },
        include: { property: { select: { id: true, title: true, ref: true, status: true } } },
      });
      if (!sale) return jsonError("Sale not found", 404);

      const isCreator = sale.createdById === user.id;
      const approver = canApprove(ENTITY, user.role);
      let nextStatus = "";
      const historyNote = reason || null;

      switch (action) {
        case "submit": {
          if (!TXN_SUBMITTABLE_FROM.includes(sale.status)) {
            return jsonError(`Cannot submit a sale in ${sale.status.toLowerCase()} status`, 400);
          }
          if (!canSubmit(ENTITY, user.role) && !isCreator) {
            return jsonError("You do not have permission to submit this sale", 403);
          }
          if (sale.saleAmount <= 0) return jsonError("Sale amount must be greater than zero before submission", 400);
          nextStatus = "SUBMITTED";
          break;
        }
        case "start_review": {
          if (sale.status !== "SUBMITTED") return jsonError("Only submitted sales can move to review", 400);
          if (!approver) return jsonError("Only managers and administrators can review sales", 403);
          nextStatus = "UNDER_REVIEW";
          break;
        }
        case "approve": {
          if (!TXN_DECIDABLE_FROM.includes(sale.status)) {
            return jsonError(`Cannot approve a sale in ${sale.status.toLowerCase()} status`, 400);
          }
          if (!approver) return jsonError("Only managers and administrators can approve sales", 403);
          nextStatus = "APPROVED";
          break;
        }
        case "reject": {
          if (!TXN_DECIDABLE_FROM.includes(sale.status)) {
            return jsonError(`Cannot reject a sale in ${sale.status.toLowerCase()} status`, 400);
          }
          if (!approver) return jsonError("Only managers and administrators can reject sales", 403);
          if (!reason) return jsonError("A rejection reason is required", 400);
          nextStatus = "REJECTED";
          break;
        }
        case "return": {
          if (!TXN_DECIDABLE_FROM.includes(sale.status)) {
            return jsonError(`Cannot return a sale in ${sale.status.toLowerCase()} status`, 400);
          }
          if (!approver) return jsonError("Only managers and administrators can return sales", 403);
          if (!reason) return jsonError("A reason is required to return a sale", 400);
          nextStatus = "RETURNED";
          break;
        }
        case "cancel": {
          if (!["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(sale.status)) {
            return jsonError(`Cannot cancel a sale in ${sale.status.toLowerCase()} status`, 400);
          }
          if (!isCreator && user.role !== "ADMIN") {
            return jsonError("Only the creator or an administrator can cancel this sale", 403);
          }
          nextStatus = "CANCELLED";
          break;
        }
        default:
          return jsonError("Unknown action", 400);
      }

      const updated = await db.$transaction(async (tx) => {
        const data: Prisma.SaleUncheckedUpdateInput = { status: nextStatus };
        if (action === "submit") data.submittedAt = new Date();
        if (["approve", "reject", "return", "start_review"].includes(action)) {
          data.reviewedById = user.id;
          data.reviewedAt = new Date();
          data.reviewNote = historyNote;
        }
        const result = await tx.sale.update({ where: { id }, data });

        // Side effects: approving a sale marks the property sold (SRS §4 lifecycle)
        if (action === "approve" && (sale.property.status === "AVAILABLE" || sale.property.status === "RESERVED")) {
          await tx.property.update({
            where: { id: sale.property.id },
            data: { status: "SOLD" },
          });
          await tx.statusHistory.create({
            data: {
              entityType: "PROPERTY",
              entityId: sale.property.id,
              entityRef: sale.property.ref ?? null,
              action: "STATUS_CHANGE",
              fromStatus: sale.property.status,
              toStatus: "SOLD",
              note: `Marked sold by approved sale ${sale.ref}`,
              userId: user.id,
            },
          });
        }

        await tx.statusHistory.create({
          data: {
            entityType: ENTITY,
            entityId: id,
            entityRef: sale.ref,
            action: action.toUpperCase(),
            fromStatus: sale.status,
            toStatus: nextStatus,
            note: historyNote,
            userId: user.id,
          },
        });
        await tx.activity.create({
          data: {
            type: "STATUS_CHANGE",
            content: `Sale **${sale.ref}** ${action.replace("_", " ")}${reason ? ` — ${reason}` : ""}`,
            entityType: ENTITY,
            entityId: id,
            propertyId: sale.propertyId,
            userId: user.id,
          },
        });
        return result;
      });

      return NextResponse.json({ sale: updated });
    }

    const existing = await db.sale.findUnique({ where: { id } });
    if (!existing) return jsonError("Sale not found", 404);

    // SRS §6: completed or approved records have edit restrictions
    if (!TXN_EDITABLE_STATUSES.includes(existing.status)) {
      return jsonError(`Sale ${existing.ref} is ${existing.status.toLowerCase()} and locked for editing`, 403);
    }

    const sale = await db.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: saleData(body, false) as Prisma.SaleUncheckedUpdateInput,
      });
      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: existing.ref,
          action: "UPDATED",
          fromStatus: existing.status,
          toStatus: updated.status,
          note: "Sale details updated",
          userId: user.id,
        },
      });
      return updated;
    });
    return NextResponse.json({ sale });
  });
}
