import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { bookingData } from "@/lib/forms";
import { nextRef } from "@/lib/refs";
import { canSubmit, TXN_OPEN_STATUSES } from "@/lib/approval";

const ENTITY = "BOOKING";
const RECEIVED_WHERE = { direction: "RECEIPT", status: "CONFIRMED" } as const;

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const status = sp.get("status");
    const propertyId = sp.get("propertyId");
    const customerId = sp.get("customerId");

    const and: Prisma.BookingWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { ref: { contains: q } },
          { customer: { is: { name: { contains: q } } } },
          { property: { is: { title: { contains: q } } } },
          { property: { is: { ref: { contains: q } } } },
        ],
      });
    }
    if (status) and.push({ status });
    if (propertyId) and.push({ propertyId });
    if (customerId) and.push({ customerId });

    const bookings = await db.booking.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, ref: true } },
        property: { select: { id: true, title: true, ref: true, status: true } },
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    // Payments link polymorphically via relatedType/relatedId (see schema Payment model) —
    // there is no FK relation to include, so sum received receipts per booking instead.
    const receivedSums = await db.payment.groupBy({
      by: ["relatedId"],
      where: {
        relatedType: ENTITY,
        ...RECEIVED_WHERE,
        relatedId: { in: bookings.map((b) => b.id) },
      },
      _sum: { amount: true },
    });
    const receivedByBooking = new Map<string, number>();
    for (const s of receivedSums) {
      if (s.relatedId) receivedByBooking.set(s.relatedId, s._sum.amount ?? 0);
    }

    const active = bookings.filter((b) => TXN_OPEN_STATUSES.includes(b.status));
    const pendingReview = bookings.filter((b) => b.status === "SUBMITTED" || b.status === "UNDER_REVIEW");
    const receivedTotal = Array.from(receivedByBooking.values()).reduce((s, v) => s + v, 0);
    const bookedValue = active.reduce((s, b) => s + b.bookingAmount, 0);

    return NextResponse.json({
      bookings: bookings.map((b) => ({
        ...b,
        received: receivedByBooking.get(b.id) ?? 0,
      })),
      summary: {
        total: bookings.length,
        pendingReview: pendingReview.length,
        approved: bookings.filter((b) => b.status === "APPROVED").length,
        completed: bookings.filter((b) => b.status === "COMPLETED").length,
        bookedValue,
        received: receivedTotal,
        outstanding: Math.max(bookedValue - receivedTotal, 0),
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canSubmit(ENTITY, user.role)) {
      return jsonError("Your role cannot create bookings", 403);
    }
    const body = (await req.json()) as Record<string, unknown>;
    const propertyId = body.propertyId ? String(body.propertyId) : "";
    const customerId = body.customerId ? String(body.customerId) : "";
    if (!propertyId) return jsonError("Property is required", 400);
    if (!customerId) return jsonError("Customer is required", 400);

    // Business rules (SRS §6): no duplicate/conflicting active bookings, property must be bookable
    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property) return jsonError("Property not found", 404);
    if (property.status === "SOLD" || property.status === "INACTIVE") {
      return jsonError(`Property is ${property.status.toLowerCase()} and cannot be booked`, 400);
    }
    const conflict = await db.booking.findFirst({
      where: { propertyId, status: { in: [...TXN_OPEN_STATUSES] } },
      select: { ref: true },
    });
    if (conflict) {
      return jsonError(`Conflict: booking ${conflict.ref} is already active for this property`, 409);
    }

    const booking = await db.$transaction(async (tx) => {
      const ref = await nextRef(tx, "BKG");
      const created = await tx.booking.create({
        data: {
          ...(bookingData(body, true) as Prisma.BookingUncheckedCreateInput),
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
          note: "Booking created",
          userId: user.id,
        },
      });
      await tx.activity.create({
        data: {
          type: "SYSTEM",
          content: `Booking **${created.ref}** created for ${property.title}`,
          entityType: ENTITY,
          entityId: created.id,
          propertyId: property.id,
          userId: user.id,
        },
      });
      return created;
    });

    return NextResponse.json({ booking });
  });
}
