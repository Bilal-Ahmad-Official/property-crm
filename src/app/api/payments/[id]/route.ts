import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { paymentData } from "@/lib/forms";

const ENTITY = "PAYMENT";
type Ctx = { params: Promise<{ id: string }> };

async function loadPayment(id: string) {
  return db.payment.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, ref: true, email: true, phone: true } },
      property: { select: { id: true, title: true, ref: true, status: true, city: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const payment = await loadPayment(id);
    if (!payment) return jsonError("Payment not found", 404);

    const history = await db.statusHistory.findMany({
      where: { entityType: ENTITY, entityId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({
      payment,
      history: history.map((h) => ({ ...h, user: h.user?.name ?? null })),
    });
  });
}

// Status actions (SRS §7/§8): confirm | cancel — status changes only ride these
// actions; field edits ride the same PATCH while the payment is still pending
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing) return jsonError("Payment not found", 404);

    const action = body.action !== undefined ? String(body.action) : "";
    const note = body.note ? String(body.note).trim() : null;

    if (action) {
      let nextStatus = "";
      if (action === "confirm") {
        if (existing.status !== "PENDING") {
          return jsonError(`Cannot confirm a payment in ${existing.status.toLowerCase()} status`, 400);
        }
        nextStatus = "CONFIRMED";
      } else if (action === "cancel") {
        if (existing.status === "CANCELLED") return jsonError("Payment is already cancelled", 400);
        nextStatus = "CANCELLED";
      } else {
        return jsonError("Unknown action", 400);
      }

      const payment = await db.$transaction(async (tx) => {
        const updated = await tx.payment.update({ where: { id }, data: { status: nextStatus } });
        await tx.statusHistory.create({
          data: {
            entityType: ENTITY,
            entityId: id,
            entityRef: existing.ref,
            action: "STATUS_CHANGE",
            fromStatus: existing.status,
            toStatus: nextStatus,
            note: note ?? `Payment ${action === "confirm" ? "confirmed" : "cancelled"}`,
            userId: user.id,
          },
        });
        return updated;
      });
      return NextResponse.json({ payment });
    }

    // Field edits (SRS §7): only while pending
    if (existing.status !== "PENDING") {
      return jsonError(`Payment ${existing.ref} is ${existing.status.toLowerCase()} and locked for editing`, 400);
    }
    const data: Record<string, unknown> = { ...paymentData(body, false) };
    // Only amount, method, notes and paymentDate are editable — status and
    // direction change through the confirm/cancel actions above
    delete data.status;
    delete data.direction;
    delete data.relatedType;
    delete data.relatedId;
    delete data.relatedRef;
    delete data.customerId;
    delete data.propertyId;

    const payment = await db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: data as Prisma.PaymentUncheckedUpdateInput,
      });
      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: existing.ref,
          action: "UPDATED",
          fromStatus: existing.status,
          toStatus: existing.status,
          note: "Payment details updated",
          userId: user.id,
        },
      });
      return updated;
    });
    return NextResponse.json({ payment });
  });
}
