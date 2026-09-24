import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ForbiddenError, requireRole, requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";

const ALLOWED_KEYS = ["orgName", "currency", "dateFormat"] as const;
type SettingKey = (typeof ALLOWED_KEYS)[number];

const DEFAULTS: Record<SettingKey, string> = {
  orgName: "Property CRM",
  currency: "USD",
  dateFormat: "MMM D, YYYY",
};

export async function GET() {
  return handle(async () => {
    await requireUser();
    const rows = await db.setting.findMany({ where: { key: { in: [...ALLOWED_KEYS] } } });
    const settings: Record<SettingKey, string> = { ...DEFAULTS };
    for (const row of rows) {
      if ((ALLOWED_KEYS as readonly string[]).includes(row.key)) {
        settings[row.key as SettingKey] = row.value;
      }
    }
    return NextResponse.json({ settings });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    await requireRole(["ADMIN"]);
    const body = (await req.json()) as Record<string, unknown>;
    const updates = ALLOWED_KEYS.filter((k) => typeof body[k] === "string" && String(body[k]).trim() !== "");
    if (updates.length === 0) throw new ForbiddenError("No valid settings provided");
    for (const key of updates) {
      const value = String(body[key]).trim();
      await db.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    const rows = await db.setting.findMany({ where: { key: { in: [...ALLOWED_KEYS] } } });
    const settings: Record<SettingKey, string> = { ...DEFAULTS };
    for (const row of rows) settings[row.key as SettingKey] = row.value;
    return NextResponse.json({ settings });
  });
}
