import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSessionUser, requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    return NextResponse.json({ user });
  });
}

// Profile/session controls (SRS §10): update own name and password
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const sessionUser = await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    const data: { name?: string; password?: string } = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.newPassword === "string" && body.newPassword) {
      if (body.newPassword.length < 6) return jsonError("New password must be at least 6 characters", 400);
      const user = await db.user.findUnique({ where: { id: sessionUser.id } });
      if (!user) return jsonError("User not found", 404);
      const currentOk = typeof body.currentPassword === "string" && (await bcrypt.compare(body.currentPassword, user.password));
      if (!currentOk) return jsonError("Current password is incorrect", 400);
      data.password = await bcrypt.hash(body.newPassword, 10);
    }

    if (Object.keys(data).length === 0) return jsonError("Nothing to update", 400);
    await db.user.update({ where: { id: sessionUser.id }, data });
    const user = await db.user.findUnique({ where: { id: sessionUser.id } });
    return NextResponse.json({ user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null });
  });
}
