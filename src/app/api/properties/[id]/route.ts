import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { propertyData } from "@/lib/forms";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const property = await db.property.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { leads: true, deals: true } },
      },
    });
    if (!property) return jsonError("Property not found", 404);
    const activities = await db.activity.findMany({
      where: { entityType: "PROPERTY", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ property, activities });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.property.findUnique({ where: { id } });
    if (!existing) return jsonError("Property not found", 404);
    const data = propertyData(body, false);
    const property = await db.property.update({ where: { id }, data: data as Record<string, unknown> });
    return NextResponse.json({ property });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const existing = await db.property.findUnique({ where: { id } });
    if (!existing) return jsonError("Property not found", 404);
    // Detach dependents, then delete (activities cascade via entity links)
    await db.lead.updateMany({ where: { propertyId: id }, data: { propertyId: null } });
    await db.deal.updateMany({ where: { propertyId: id }, data: { propertyId: null } });
    await db.activity.deleteMany({ where: { entityType: "PROPERTY", entityId: id } });
    await db.activity.updateMany({ where: { propertyId: id }, data: { propertyId: null } });
    await db.task.updateMany({ where: { relatedType: "PROPERTY", relatedId: id }, data: { relatedType: null, relatedId: null } });
    await db.property.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
