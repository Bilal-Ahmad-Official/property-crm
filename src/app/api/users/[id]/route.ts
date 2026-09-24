import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { ROLES } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

// User administration (SRS §2/§8): admins update name, role and active state
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireRole(["ADMIN"]);
    const { id } = await ctx.params;
    const body = (await req.json()) as { name?: string; role?: string; isActive?: boolean };
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return jsonError("User not found", 404);

    const data: { name?: string; role?: string; isActive?: boolean } = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.role === "string") {
      if (!(ROLES as readonly string[]).includes(body.role)) return jsonError("Invalid role", 400);
      data.role = body.role;
    }
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (Object.keys(data).length === 0) return jsonError("Nothing to update", 400);

    // Never let an admin lock themselves out of the system
    if (id === me.id && (data.isActive === false || (data.role !== undefined && data.role !== "ADMIN"))) {
      return jsonError("You cannot deactivate or demote your own account", 400);
    }

    const user = await db.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ user });
  });
}
