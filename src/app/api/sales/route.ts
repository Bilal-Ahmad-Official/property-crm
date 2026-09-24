import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { saleData } from "@/lib/forms";
import { nextRef } from "@/lib/refs";
import { canSubmit, TXN_OPEN_STATUSES } from "@/lib/approval";

const ENTITY = "SALE";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const status = sp.get("status");
    const propertyId = sp.get("propertyId");
    const customerId = sp.get("customerId");

    const and: Prisma.SaleWhereInput[] = [];
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

    const sales = await db.sale.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, ref: true } },
        property: { select: { id: true, title: true, ref: true, status: true } },
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } },
      },
    });

    const active = sales.filter((s) => TXN_OPEN_STATUSES.includes(s.status));
    const pendingReview = sales.filter((s) => s.status === "SUBMITTED" || s.status === "UNDER_REVIEW");
    const saleValue = active.reduce((sum, s) => sum + s.saleAmount, 0);
    const commission = active.reduce((sum, s) => sum + s.commission, 0);

    return NextResponse.json({
      sales,
      summary: {
        total: sales.length,
        pendingReview: pendingReview.length,
        approved: sales.filter((s) => s.status === "APPROVED").length,
        completed: sales.filter((s) => s.status === "COMPLETED").length,
        saleValue,
        commission,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canSubmit(ENTITY, user.role)) {
      return jsonError("Your role cannot create sales", 403);
    }
    const body = (await req.json()) as Record<string, unknown>;
    const propertyId = body.propertyId ? String(body.propertyId) : "";
    const customerId = body.customerId ? String(body.customerId) : "";
    if (!propertyId) return jsonError("Property is required", 400);
    if (!customerId) return jsonError("Customer is required", 400);

    // Business rules (SRS §6): customer and property must exist, no duplicate/conflicting active sales
    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property) return jsonError("Property not found", 404);
    const customer = await db.contact.findUnique({ where: { id: customerId } });
    if (!customer) return jsonError("Customer not found", 404);
    const conflict = await db.sale.findFirst({
      where: { propertyId, status: { in: [...TXN_OPEN_STATUSES] } },
      select: { ref: true },
    });
    if (conflict) {
      return jsonError(`Conflict: sale ${conflict.ref} is already active for this property`, 409);
    }

    const sale = await db.$transaction(async (tx) => {
      const ref = await nextRef(tx, "SAL");
      const created = await tx.sale.create({
        data: {
          ...(saleData(body, true) as Prisma.SaleUncheckedCreateInput),
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
          note: "Sale created",
          userId: user.id,
        },
      });
      await tx.activity.create({
        data: {
          type: "SYSTEM",
          content: `Sale **${created.ref}** created for ${property.title}`,
          entityType: ENTITY,
          entityId: created.id,
          propertyId: property.id,
          userId: user.id,
        },
      });
      return created;
    });

    return NextResponse.json({ sale });
  });
}
