import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { contactData } from "@/lib/forms";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const contact = await db.contact.findUnique({ where: { id } });
    if (!contact) return jsonError("Contact not found", 404);
    const activities = await db.activity.findMany({
      where: { entityType: "CONTACT", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ contact, activities });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.contact.findUnique({ where: { id } });
    if (!existing) return jsonError("Contact not found", 404);
    const contact = await db.contact.update({ where: { id }, data: contactData(body) as Record<string, unknown> });
    return NextResponse.json({ contact });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const existing = await db.contact.findUnique({ where: { id } });
    if (!existing) return jsonError("Contact not found", 404);
    await db.lead.updateMany({ where: { contactId: id }, data: { contactId: null } });
    await db.deal.updateMany({ where: { contactId: id }, data: { contactId: null } });
    await db.activity.deleteMany({ where: { entityType: "CONTACT", entityId: id } });
    await db.activity.updateMany({ where: { contactId: id }, data: { contactId: null } });
    await db.task.updateMany({ where: { relatedType: "CONTACT", relatedId: id }, data: { relatedType: null, relatedId: null } });
    await db.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
