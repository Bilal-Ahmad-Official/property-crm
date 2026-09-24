import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { chargeData } from "@/lib/forms";

const ENTITY = "CHARGE";
type Ctx = { params: Promise<{ id: string }> };

async function loadCharge(id: string) {
  return db.charge.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, title: true, ref: true, status: true } },
      customer: { select: { id: true, name: true, ref: true, email: true, phone: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const charge = await loadCharge(id);
    if (!charge) return jsonError("Charge not found", 404);

    const history = await db.statusHistory.findMany({
      where: { entityType: ENTITY, entityId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({
      charge,
      history: history.map((h) => ({ ...h, user: h.user?.name ?? null })),
    });
  });
}

// Field edits (only while pending) and status actions: mark_paid | mark_waived | cancel
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action ? String(body.action) : "";
    const existing = await db.charge.findUnique({ where: { id } });
    if (!existing) return jsonError("Charge not found", 404);

    // (a) Field edits: locked once a charge leaves pending status
    if (!action) {
      if (existing.status !== "PENDING") {
        return jsonError(`Charge ${existing.ref} is locked — only pending charges can be edited`, 403);
      }
      const charge = await db.$transaction(async (tx) => {
        const updated = await tx.charge.update({
          where: { id },
          data: chargeData(body, false) as Prisma.ChargeUncheckedUpdateInput,
        });
        await tx.statusHistory.create({
          data: {
            entityType: ENTITY,
            entityId: id,
            entityRef: existing.ref,
            action: "UPDATED",
            fromStatus: existing.status,
            toStatus: updated.status,
            note: "Charge details updated",
            userId: user.id,
          },
        });
        return updated;
      });
      return NextResponse.json({ charge });
    }

    // (b) Status actions: PENDING → PAID | WAIVED | CANCELLED only (SRS §3 item 10)
    const transitions: Record<string, string> = { mark_paid: "PAID", mark_waived: "WAIVED", cancel: "CANCELLED" };
    const nextStatus = transitions[action];
    if (!nextStatus) return jsonError("Unknown action", 400);
    if (existing.status !== "PENDING") {
      return jsonError(`Cannot ${action.replace("_", " ")} a charge in ${existing.status.toLowerCase()} status`, 400);
    }
    const note = body.note ? String(body.note).trim() : "";
    const defaultNotes: Record<string, string> = {
      mark_paid: "Charge marked paid",
      mark_waived: "Charge waived",
      cancel: "Charge cancelled",
    };

    const charge = await db.$transaction(async (tx) => {
      const updated = await tx.charge.update({
        where: { id },
        data: { status: nextStatus },
      });
      await tx.statusHistory.create({
        data: {
          entityType: ENTITY,
          entityId: id,
          entityRef: existing.ref,
          action: "STATUS_CHANGE",
          fromStatus: existing.status,
          toStatus: nextStatus,
          note: note || defaultNotes[action],
          userId: user.id,
        },
      });
      return updated;
    });

    return NextResponse.json({ charge });
  });
}
