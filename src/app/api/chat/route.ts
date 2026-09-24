import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { isAIConfigured, runAgent, ChatMsg } from "@/lib/ai/agent";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sessionId = req.nextUrl.searchParams.get("sessionId") || "default";
    const messages = await db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return NextResponse.json({ messages, aiConfigured: isAIConfigured(), model: process.env.AI_MODEL || null });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json()) as {
      sessionId?: string;
      message?: string;
      pageContext?: string;
    };
    const message = String(body.message || "").trim();
    const sessionId = String(body.sessionId || "default");
    if (!message) return jsonError("Message is required");

    const prev = await db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    await db.chatMessage.create({ data: { sessionId, role: "user", content: message } });

    const history: ChatMsg[] = [
      ...prev.map((m) => ({ role: m.role as ChatMsg["role"], content: m.content })),
      { role: "user", content: message },
    ];

    const { reply, actions, mode } = await runAgent(history, body.pageContext);

    const saved = await db.chatMessage.create({
      data: { sessionId, role: "assistant", content: reply },
    });

    return NextResponse.json({
      reply,
      actions,
      mode,
      messageId: saved.id,
      answeredBy: user.name,
    });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sessionId = req.nextUrl.searchParams.get("sessionId") || "default";
    await db.chatMessage.deleteMany({ where: { sessionId } });
    return NextResponse.json({ ok: true });
  });
}
