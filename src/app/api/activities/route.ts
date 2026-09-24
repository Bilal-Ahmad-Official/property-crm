import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json()) as {
      entityType?: string;
      entityId?: string;
      content?: string;
      type?: string;
    };
    const entityType = String(body.entityType || "").toUpperCase();
    const entityId = String(body.entityId || "");
    const content = String(body.content || "").trim();
    const type = String(body.type || "NOTE").toUpperCase();
    if (!["PROPERTY", "LEAD", "DEAL", "CONTACT"].includes(entityType)) return jsonError("Invalid entityType");
    if (!entityId) return jsonError("entityId is required");
    if (!content) return jsonError("Note content is required");

    const activity = await db.activity.create({
      data: {
        type,
        content,
        entityType,
        entityId,
        userId: user.id,
        propertyId: entityType === "PROPERTY" ? entityId : undefined,
        leadId: entityType === "LEAD" ? entityId : undefined,
        dealId: entityType === "DEAL" ? entityId : undefined,
        contactId: entityType === "CONTACT" ? entityId : undefined,
      },
    });
    return NextResponse.json({ activity });
  });
}
