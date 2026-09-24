import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { taskData } from "@/lib/forms";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) return jsonError("Task not found", 404);
    const task = await db.task.update({ where: { id }, data: taskData(body) as Record<string, unknown> });
    return NextResponse.json({ task });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) return jsonError("Task not found", 404);
    await db.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
