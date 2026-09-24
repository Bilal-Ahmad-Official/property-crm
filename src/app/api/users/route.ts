import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { ROLES } from "@/lib/utils";

export async function GET() {
  return handle(async () => {
    await requireUser();
    const users = await db.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ users });
  });
}

// User administration (SRS §2/§8): admins create accounts with a role
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireRole(["ADMIN"]);
    const body = (await req.json()) as { name?: string; email?: string; password?: string; role?: string };
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "").trim();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Name, email, password and role are required" }, { status: 400 });
    }
    if (!email.includes("@")) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    if (!(ROLES as readonly string[]).includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });

    const user = await db.user.create({
      data: { name, email, password: await bcrypt.hash(password, 10), role },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ user });
  });
}
