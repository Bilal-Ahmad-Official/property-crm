import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { leadData } from "@/lib/forms";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, title: true } },
        assignedTo: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
      },
    });
    if (!lead) return jsonError("Lead not found", 404);
    const activities = await db.activity.findMany({
      where: { entityType: "LEAD", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ lead, activities });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) return jsonError("Lead not found", 404);
    const data = leadData(body);
    const lead = await db.lead.update({ where: { id }, data: data as Record<string, unknown> });
    return NextResponse.json({ lead });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) return jsonError("Lead not found", 404);
    await db.deal.updateMany({ where: { leadId: id }, data: { leadId: null } });
    await db.activity.deleteMany({ where: { entityType: "LEAD", entityId: id } });
    await db.activity.updateMany({ where: { leadId: id }, data: { leadId: null } });
    await db.task.updateMany({ where: { relatedType: "LEAD", relatedId: id }, data: { relatedType: null, relatedId: null } });
    await db.lead.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
