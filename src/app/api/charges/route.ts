import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { chargeData } from "@/lib/forms";
import { nextRef } from "@/lib/refs";

const ENTITY = "CHARGE";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const status = sp.get("status");
    const chargeType = sp.get("chargeType");
    const propertyId = sp.get("propertyId");
    const customerId = sp.get("customerId");

    const and: Prisma.ChargeWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { ref: { contains: q } },
          { title: { contains: q } },
          { relatedRef: { contains: q } },
        ],
      });
    }
    if (status) and.push({ status });
    if (chargeType) and.push({ chargeType });
    if (propertyId) and.push({ propertyId });
    if (customerId) and.push({ customerId });

    const charges = await db.charge.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        property: { select: { id: true, title: true, ref: true } },
        customer: { select: { id: true, name: true, ref: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Charges have no approval lifecycle — money totals are summed per status (SRS §3 item 10)
    const sumByStatus = (s: string) => charges.filter((c) => c.status === s).reduce((acc, c) => acc + c.amount, 0);

    return NextResponse.json({
      charges,
      summary: {
        total: charges.length,
        outstanding: sumByStatus("PENDING"),
        paid: sumByStatus("PAID"),
        waived: sumByStatus("WAIVED"),
      },
    });
  });
}

// Any logged-in user can record charges — no approval lifecycle on this model
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.title) return jsonError("Title is required", 400);

    const charge = await db.$transaction(async (tx) => {
      const ref = await nextRef(tx, "CHG");
      const created = await tx.charge.create({
        data: {
          ...(chargeData(body, true) as Prisma.ChargeUncheckedCreateInput),
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
          note: "Charge created",
          userId: user.id,
        },
      });
      return created;
    });

    return NextResponse.json({ charge });
  });
}
