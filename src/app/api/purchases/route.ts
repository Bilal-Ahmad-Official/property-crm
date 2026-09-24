import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { purchaseData } from "@/lib/forms";
import { nextRef } from "@/lib/refs";
import { canSubmit, TXN_OPEN_STATUSES } from "@/lib/approval";

const ENTITY = "PURCHASE";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const status = sp.get("status");
    const propertyId = sp.get("propertyId");

    const and: Prisma.PurchaseWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { ref: { contains: q } },
          { vendor: { is: { name: { contains: q } } } },
          { property: { is: { title: { contains: q } } } },
          { property: { is: { ref: { contains: q } } } },
        ],
      });
    }
    if (status) and.push({ status });
    if (propertyId) and.push({ propertyId });

    const purchases = await db.purchase.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        vendor: { select: { id: true, name: true, ref: true } },
        property: { select: { id: true, title: true, ref: true, status: true } },
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    const active = purchases.filter((p) => TXN_OPEN_STATUSES.includes(p.status));
    const pendingReview = purchases.filter((p) => p.status === "SUBMITTED" || p.status === "UNDER_REVIEW");
    const purchaseValue = active.reduce((s, p) => s + p.purchaseAmount, 0);

    return NextResponse.json({
      purchases,
      summary: {
        total: purchases.length,
        pendingReview: pendingReview.length,
        approved: purchases.filter((p) => p.status === "APPROVED").length,
        completed: purchases.filter((p) => p.status === "COMPLETED").length,
        purchaseValue,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canSubmit(ENTITY, user.role)) {
      return jsonError("Your role cannot create purchases", 403);
    }
    const body = (await req.json()) as Record<string, unknown>;
    const propertyId = body.propertyId ? String(body.propertyId) : "";
    const vendorId = body.vendorId ? String(body.vendorId) : "";
    if (!propertyId) return jsonError("Property is required", 400);
    if (!vendorId) return jsonError("Vendor is required", 400);

    // Only existence is validated — a property is acquired from a vendor regardless
    // of its listing status (SRS §6), so no bookable-status or conflict checks apply
    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property) return jsonError("Property not found", 404);
    const vendor = await db.contact.findUnique({ where: { id: vendorId } });
    if (!vendor) return jsonError("Vendor not found", 404);

    const purchase = await db.$transaction(async (tx) => {
      const ref = await nextRef(tx, "PRC");
      const created = await tx.purchase.create({
        data: {
          ...(purchaseData(body, true) as Prisma.PurchaseUncheckedCreateInput),
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
          note: "Purchase created",
          userId: user.id,
        },
      });
      await tx.activity.create({
        data: {
          type: "SYSTEM",
          content: `Purchase **${created.ref}** created for ${property.title} from ${vendor.name}`,
          entityType: ENTITY,
          entityId: created.id,
          propertyId: property.id,
          userId: user.id,
        },
      });
      return created;
    });

    return NextResponse.json({ purchase });
  });
}
