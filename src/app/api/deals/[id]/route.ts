import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { dealData } from "@/lib/forms";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const deal = await db.deal.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, title: true } },
        contact: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    if (!deal) return jsonError("Deal not found", 404);
    const activities = await db.activity.findMany({
      where: { entityType: "DEAL", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ deal, activities });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.deal.findUnique({ where: { id } });
    if (!existing) return jsonError("Deal not found", 404);
    const data = dealData(body);
    // Auto-manage closedAt when moving to/from a closed stage
    if (typeof data.stage === "string" && data.stage.startsWith("CLOSED") && !existing.closedAt && data.closedAt === undefined) {
      data.closedAt = new Date();
    }
    if (typeof data.stage === "string" && !data.stage.startsWith("CLOSED") && existing.closedAt) {
      data.closedAt = null;
    }
    const deal = await db.deal.update({ where: { id }, data: data as Record<string, unknown> });
    return NextResponse.json({ deal });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const existing = await db.deal.findUnique({ where: { id } });
    if (!existing) return jsonError("Deal not found", 404);
    await db.activity.deleteMany({ where: { entityType: "DEAL", entityId: id } });
    await db.activity.updateMany({ where: { dealId: id }, data: { dealId: null } });
    await db.task.updateMany({ where: { relatedType: "DEAL", relatedId: id }, data: { relatedType: null, relatedId: null } });
    await db.deal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
