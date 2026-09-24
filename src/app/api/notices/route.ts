import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { noticeData } from "@/lib/forms";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const audience = sp.get("audience");

    const where: Prisma.NoticeWhereInput = {};
    if (status) where.status = status;
    if (audience) where.audience = audience;

    const notices = await db.notice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ notices });
  });
}

// Only managers and administrators publish notices (SRS §8 role-based access)
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireRole(["ADMIN", "MANAGER"]);
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.title) return jsonError("Title is required", 400);
    if (!body.content) return jsonError("Content is required", 400);

    const notice = await db.notice.create({
      data: {
        ...(noticeData(body, true) as Prisma.NoticeUncheckedCreateInput),
        createdById: user.id,
      },
    });

    return NextResponse.json({ notice });
  });
}

// Publish/archive actions — admin/manager only
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    await requireRole(["ADMIN", "MANAGER"]);
    const body = (await req.json()) as Record<string, unknown>;
    const id = body.id ? String(body.id) : "";
    const action = String(body.action || "");
    if (!id) return jsonError("Notice id is required", 400);

    const existing = await db.notice.findUnique({ where: { id } });
    if (!existing) return jsonError("Notice not found", 404);

    let nextStatus = "";
    if (action === "publish") nextStatus = "PUBLISHED";
    else if (action === "archive") nextStatus = "ARCHIVED";
    else return jsonError("Unknown action", 400);
    if (existing.status === nextStatus) {
      return jsonError(`Notice is already ${nextStatus.toLowerCase()}`, 400);
    }

    const data: Prisma.NoticeUncheckedUpdateInput = { status: nextStatus };
    if (action === "publish") data.publishedAt = new Date();

    const notice = await db.notice.update({ where: { id }, data });
    return NextResponse.json({ notice });
  });
}
