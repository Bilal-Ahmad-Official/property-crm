import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { paymentData } from "@/lib/forms";
import { nextRef } from "@/lib/refs";

const ENTITY = "PAYMENT";

// Payments link polymorphically via relatedType/relatedId (see schema Payment model) —
// there is no FK relation to include, so resolve the link against the owning
// transaction model to verify it exists and denormalize its business ref.
async function loadRelated(type: string, id: string) {
  switch (type) {
    case "BOOKING":
      return db.booking.findUnique({ where: { id }, select: { ref: true } });
    case "SALE":
      return db.sale.findUnique({ where: { id }, select: { ref: true } });
    case "PURCHASE":
      return db.purchase.findUnique({ where: { id }, select: { ref: true } });
    case "TRANSFER":
      return db.propertyTransfer.findUnique({ where: { id }, select: { ref: true } });
    case "BUYBACK":
      return db.buyBack.findUnique({ where: { id }, select: { ref: true } });
    case "CHARGE":
      return db.charge.findUnique({ where: { id }, select: { ref: true } });
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const direction = sp.get("direction");
    const status = sp.get("status");
    const relatedType = sp.get("relatedType");
    const relatedId = sp.get("relatedId");
    const customerId = sp.get("customerId");
    const propertyId = sp.get("propertyId");

    const and: Prisma.PaymentWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { ref: { contains: q } },
          { relatedRef: { contains: q } },
          { customer: { is: { name: { contains: q } } } },
        ],
      });
    }
    if (direction) and.push({ direction });
    if (status) and.push({ status });
    if (relatedType) and.push({ relatedType });
    if (relatedId) and.push({ relatedId });
    if (customerId) and.push({ customerId });
    if (propertyId) and.push({ propertyId });

    const payments = await db.payment.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { paymentDate: "desc" },
      include: {
        customer: { select: { id: true, name: true, ref: true } },
        property: { select: { id: true, title: true, ref: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Financial summary (SRS §7): confirmed receipts in, confirmed payments out
    const totalReceived = payments
      .filter((p) => p.direction === "RECEIPT" && p.status === "CONFIRMED")
      .reduce((s, p) => s + p.amount, 0);
    const totalPaid = payments
      .filter((p) => p.direction === "PAYMENT" && p.status === "CONFIRMED")
      .reduce((s, p) => s + p.amount, 0);

    return NextResponse.json({
      payments,
      summary: {
        total: payments.length,
        totalReceived,
        totalPaid,
        net: totalReceived - totalPaid,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(); // any signed-in user can record payments (SRS §7)
    const body = (await req.json()) as Record<string, unknown>;
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return jsonError("Amount must be greater than zero", 400);

    // Verify the polymorphic link points at a real transaction; an incomplete
    // link (type without id) is dropped so no half-populated fields are stored
    const relatedType = body.relatedType ? String(body.relatedType).toUpperCase() : "";
    const relatedId = body.relatedId ? String(body.relatedId) : "";
    if (relatedType && relatedId) {
      const related = await loadRelated(relatedType, relatedId);
      if (!related) return jsonError(`Related ${relatedType.toLowerCase()} not found`, 404);
      body.relatedRef = related.ref;
    } else {
      delete body.relatedType;
      delete body.relatedId;
      delete body.relatedRef;
    }

    const payment = await db.$transaction(async (tx) => {
      const ref = await nextRef(tx, "PMT");
      const created = await tx.payment.create({
        data: {
          ...(paymentData(body, true) as Prisma.PaymentUncheckedCreateInput),
          ref,
          createdById: user.id,
        },
      });
      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: created.id,
          entityRef: created.ref,
          action: "CREATED",
          toStatus: created.status,
          note: "Payment recorded",
          userId: user.id,
        },
      });
      return created;
    });

    return NextResponse.json({ payment });
  });
}
