import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { buybackData } from "@/lib/forms";
import { nextRef } from "@/lib/refs";
import { canSubmit, TXN_OPEN_STATUSES } from "@/lib/approval";

const ENTITY = "BUYBACK";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const status = sp.get("status");
    const propertyId = sp.get("propertyId");
    const customerId = sp.get("customerId");

    const and: Prisma.BuyBackWhereInput[] = [];
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

    const buybacks = await db.buyBack.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, ref: true } },
        property: { select: { id: true, title: true, ref: true, status: true } },
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    const active = buybacks.filter((b) => TXN_OPEN_STATUSES.includes(b.status));
    const pendingReview = buybacks.filter((b) => b.status === "SUBMITTED" || b.status === "UNDER_REVIEW");
    const buybackValue = active.reduce((s, b) => s + b.buybackAmount, 0);

    return NextResponse.json({
      buybacks,
      summary: {
        total: buybacks.length,
        pendingReview: pendingReview.length,
        approved: buybacks.filter((b) => b.status === "APPROVED").length,
        completed: buybacks.filter((b) => b.status === "COMPLETED").length,
        buybackValue,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canSubmit(ENTITY, user.role)) {
      return jsonError("Your role cannot create buy-backs", 403);
    }
    const body = (await req.json()) as Record<string, unknown>;
    const propertyId = body.propertyId ? String(body.propertyId) : "";
    const customerId = body.customerId ? String(body.customerId) : "";
    if (!propertyId) return jsonError("Property is required", 400);
    if (!customerId) return jsonError("Customer is required", 400);

    // A buy-back intentionally targets sold properties (the customer returns them to
    // inventory), so unlike bookings there is no property-status or conflict check.
    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property) return jsonError("Property not found", 404);
    const customer = await db.contact.findUnique({ where: { id: customerId } });
    if (!customer) return jsonError("Customer not found", 404);

    const buyback = await db.$transaction(async (tx) => {
      const ref = await nextRef(tx, "BBK");
      const created = await tx.buyBack.create({
        data: {
          ...(buybackData(body, true) as Prisma.BuyBackUncheckedCreateInput),
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
          note: "Buy-back created",
          userId: user.id,
        },
      });
      await tx.activity.create({
        data: {
          type: "SYSTEM",
          content: `Buy-back **${created.ref}** created for ${property.title}`,
          entityType: ENTITY,
          entityId: created.id,
          propertyId: property.id,
          userId: user.id,
        },
      });
      return created;
    });

    return NextResponse.json({ buyback });
  });
}
