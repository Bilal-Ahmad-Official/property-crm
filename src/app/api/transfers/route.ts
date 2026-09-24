import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { transferData } from "@/lib/forms";
import { nextRef } from "@/lib/refs";
import { canSubmit, TXN_OPEN_STATUSES } from "@/lib/approval";

const ENTITY = "TRANSFER";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const status = sp.get("status");
    const propertyId = sp.get("propertyId");

    const and: Prisma.PropertyTransferWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { ref: { contains: q } },
          { fromCustomer: { is: { name: { contains: q } } } },
          { toCustomer: { is: { name: { contains: q } } } },
          { property: { is: { title: { contains: q } } } },
          { property: { is: { ref: { contains: q } } } },
        ],
      });
    }
    if (status) and.push({ status });
    if (propertyId) and.push({ propertyId });

    const transfers = await db.propertyTransfer.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        fromCustomer: { select: { id: true, name: true, ref: true } },
        toCustomer: { select: { id: true, name: true, ref: true } },
        property: { select: { id: true, title: true, ref: true, status: true } },
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    const active = transfers.filter((t) => TXN_OPEN_STATUSES.includes(t.status));
    const pendingReview = transfers.filter((t) => t.status === "SUBMITTED" || t.status === "UNDER_REVIEW");
    const feesTotal = active.reduce((s, t) => s + t.transferFee, 0);

    return NextResponse.json({
      transfers,
      summary: {
        total: transfers.length,
        pendingReview: pendingReview.length,
        approved: transfers.filter((t) => t.status === "APPROVED").length,
        completed: transfers.filter((t) => t.status === "COMPLETED").length,
        feesTotal,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canSubmit(ENTITY, user.role)) {
      return jsonError("Your role cannot create property transfers", 403);
    }
    const body = (await req.json()) as Record<string, unknown>;
    const propertyId = body.propertyId ? String(body.propertyId) : "";
    const toCustomerId = body.toCustomerId ? String(body.toCustomerId) : "";
    if (!propertyId) return jsonError("Property is required", 400);
    if (!toCustomerId) return jsonError("New owner is required", 400);

    // Transfers are ownership records — any property status can be transferred, but
    // both ends of the handover must exist (SRS §6)
    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property) return jsonError("Property not found", 404);
    const toCustomer = await db.contact.findUnique({ where: { id: toCustomerId } });
    if (!toCustomer) return jsonError("New owner not found", 404);
    const fromCustomerId = body.fromCustomerId ? String(body.fromCustomerId) : "";
    if (fromCustomerId) {
      const fromCustomer = await db.contact.findUnique({ where: { id: fromCustomerId } });
      if (!fromCustomer) return jsonError("From customer not found", 404);
    }

    const transfer = await db.$transaction(async (tx) => {
      const ref = await nextRef(tx, "TRF");
      const created = await tx.propertyTransfer.create({
        data: {
          ...(transferData(body, true) as Prisma.PropertyTransferUncheckedCreateInput),
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
          note: "Property transfer created",
          userId: user.id,
        },
      });
      await tx.activity.create({
        data: {
          type: "SYSTEM",
          content: `Property transfer **${created.ref}** created for ${property.title}`,
          entityType: ENTITY,
          entityId: created.id,
          propertyId: property.id,
          userId: user.id,
        },
      });
      return created;
    });

    return NextResponse.json({ transfer });
  });
}
