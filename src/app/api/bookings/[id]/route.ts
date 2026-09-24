import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { bookingData } from "@/lib/forms";
import { canApprove, canSubmit, TXN_DECIDABLE_FROM, TXN_EDITABLE_STATUSES, TXN_SUBMITTABLE_FROM } from "@/lib/approval";

const ENTITY = "BOOKING";
type Ctx = { params: Promise<{ id: string }> };

async function loadBooking(id: string) {
  return db.booking.findUnique({
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
    const booking = await loadBooking(id);
    if (!booking) return jsonError("Booking not found", 404);

    const [history, payments] = await Promise.all([
      db.statusHistory.findMany({
        where: { entityType: ENTITY, entityId: id },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
      db.payment.findMany({
        where: { relatedType: ENTITY, relatedId: id, status: { not: "CANCELLED" } },
        orderBy: { paymentDate: "desc" },
        include: { createdBy: { select: { name: true } } },
      }),
    ]);

    const received = payments
      .filter((p) => p.direction === "RECEIPT" && p.status === "CONFIRMED")
      .reduce((s, p) => s + p.amount, 0);

    return NextResponse.json({
      booking,
      history: history.map((h) => ({ ...h, user: h.user?.name ?? null })),
      payments,
      received,
      outstanding: Math.max(booking.bookingAmount - received, 0),
    });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.booking.findUnique({ where: { id } });
    if (!existing) return jsonError("Booking not found", 404);

    // SRS §6: completed or approved records have edit restrictions
    if (!TXN_EDITABLE_STATUSES.includes(existing.status)) {
      return jsonError(`Booking ${existing.ref} is ${existing.status.toLowerCase()} and locked for editing`, 403);
    }

    const booking = await db.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: bookingData(body, false) as Prisma.BookingUncheckedUpdateInput,
      });
      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: existing.ref,
          action: "UPDATED",
          fromStatus: existing.status,
          toStatus: updated.status,
          note: "Booking details updated",
          userId: user.id,
        },
      });
      return updated;
    });
    return NextResponse.json({ booking });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.booking.findUnique({ where: { id } });
    if (!existing) return jsonError("Booking not found", 404);
    if (user.role !== "ADMIN") return jsonError("Only administrators can delete bookings", 403);
    if (!["DRAFT", "REJECTED", "CANCELLED"].includes(existing.status)) {
      return jsonError("Submitted, approved and completed bookings cannot be deleted", 403);
    }
    await db.$transaction(async (tx) => {
      await tx.payment.updateMany({ where: { relatedType: ENTITY, relatedId: id }, data: { relatedType: null, relatedId: null, relatedRef: null } });
      await tx.statusHistory.deleteMany({ where: { entityType: ENTITY, entityId: id } });
      await tx.activity.deleteMany({ where: { entityType: ENTITY, entityId: id } });
      await tx.booking.delete({ where: { id } });
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

    const booking = await db.booking.findUnique({
      where: { id },
      include: { property: { select: { id: true, title: true, ref: true, status: true } } },
    });
    if (!booking) return jsonError("Booking not found", 404);

    const isCreator = booking.createdById === user.id;
    const approver = canApprove(ENTITY, user.role);
    let nextStatus = "";
    const historyNote = reason || null;

    switch (action) {
      case "submit": {
        if (!TXN_SUBMITTABLE_FROM.includes(booking.status)) {
          return jsonError(`Cannot submit a booking in ${booking.status.toLowerCase()} status`, 400);
        }
        if (!canSubmit(ENTITY, user.role) && !isCreator) {
          return jsonError("You do not have permission to submit this booking", 403);
        }
        if (booking.bookingAmount <= 0) return jsonError("Booking amount must be greater than zero before submission", 400);
        nextStatus = "SUBMITTED";
        break;
      }
      case "start_review": {
        if (booking.status !== "SUBMITTED") return jsonError("Only submitted bookings can move to review", 400);
        if (!approver) return jsonError("Only managers and administrators can review bookings", 403);
        nextStatus = "UNDER_REVIEW";
        break;
      }
      case "approve": {
        if (!TXN_DECIDABLE_FROM.includes(booking.status)) {
          return jsonError(`Cannot approve a booking in ${booking.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only managers and administrators can approve bookings", 403);
        nextStatus = "APPROVED";
        break;
      }
      case "reject": {
        if (!TXN_DECIDABLE_FROM.includes(booking.status)) {
          return jsonError(`Cannot reject a booking in ${booking.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only managers and administrators can reject bookings", 403);
        if (!reason) return jsonError("A rejection reason is required", 400);
        nextStatus = "REJECTED";
        break;
      }
      case "return": {
        if (!TXN_DECIDABLE_FROM.includes(booking.status)) {
          return jsonError(`Cannot return a booking in ${booking.status.toLowerCase()} status`, 400);
        }
        if (!approver) return jsonError("Only managers and administrators can return bookings", 403);
        if (!reason) return jsonError("A reason is required to return a booking", 400);
        nextStatus = "RETURNED";
        break;
      }
      case "cancel": {
        if (!["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(booking.status)) {
          return jsonError(`Cannot cancel a booking in ${booking.status.toLowerCase()} status`, 400);
        }
        if (!isCreator && user.role !== "ADMIN") {
          return jsonError("Only the creator or an administrator can cancel this booking", 403);
        }
        nextStatus = "CANCELLED";
        break;
      }
      default:
        return jsonError("Unknown action", 400);
    }

    const updated = await db.$transaction(async (tx) => {
      const data: Prisma.BookingUncheckedUpdateInput = { status: nextStatus };
      if (action === "submit") data.submittedAt = new Date();
      if (["approve", "reject", "return", "start_review"].includes(action)) {
        data.reviewedById = user.id;
        data.reviewedAt = new Date();
        data.reviewNote = historyNote;
      }
      const result = await tx.booking.update({ where: { id }, data });

      // Side effects: approving a booking reserves the property (SRS §4 lifecycle)
      if (action === "approve" && booking.property.status === "AVAILABLE") {
        await tx.property.update({
          where: { id: booking.property.id },
          data: { status: "RESERVED" },
        });
        await tx.statusHistory.create({
          data: {
            entityType: "PROPERTY",
            entityId: booking.property.id,
            entityRef: booking.property.ref ?? null,
            action: "STATUS_CHANGE",
            fromStatus: "AVAILABLE",
            toStatus: "RESERVED",
            note: `Reserved by approved booking ${booking.ref}`,
            userId: user.id,
          },
        });
      }

      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: booking.ref,
          action: action.toUpperCase(),
          fromStatus: booking.status,
          toStatus: nextStatus,
          note: historyNote,
          userId: user.id,
        },
      });
      await tx.activity.create({
        data: {
          type: "STATUS_CHANGE",
          content: `Booking **${booking.ref}** ${action.replace("_", " ")}${reason ? ` — ${reason}` : ""}`,
          entityType: ENTITY,
          entityId: id,
          propertyId: booking.propertyId,
          userId: user.id,
        },
      });
      return result;
    });

    return NextResponse.json({ booking: updated });
  });
}
