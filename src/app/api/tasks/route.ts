import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, date } from "@/lib/api";
import { taskData } from "@/lib/forms";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const priority = sp.get("priority");
    const overdue = sp.get("overdue") === "true";

    const and: Prisma.TaskWhereInput[] = [];
    if (status) and.push({ status });
    if (priority) and.push({ priority });
    if (overdue) and.push({ dueDate: { lt: new Date() }, status: { in: ["PENDING", "IN_PROGRESS"] } });

    const tasks = await db.task.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: { assignedTo: { select: { id: true, name: true } } },
    });

    const now = new Date();
    return NextResponse.json({
      tasks,
      counts: {
        all: undefined,
        overdue: tasks.filter((t) => t.dueDate && t.dueDate < now && (t.status === "PENDING" || t.status === "IN_PROGRESS")).length,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    const task = await db.task.create({ data: taskData(body) as Prisma.TaskUncheckedCreateInput });
    return NextResponse.json({ task });
  });
}
