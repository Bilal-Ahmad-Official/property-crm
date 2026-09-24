import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, num, date } from "@/lib/api";
import { dealData } from "@/lib/forms";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const stage = sp.get("stage");

    const and: Prisma.DealWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { title: { contains: q } },
          { property: { is: { title: { contains: q } } } },
          { contact: { is: { name: { contains: q } } } },
        ],
      });
    }
    if (stage) and.push({ stage });

    const deals = await db.deal.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        property: { select: { id: true, title: true } },
        contact: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    const openStages = ["OFFER_MADE", "DUE_DILIGENCE", "CONTRACT", "CLOSING"];
    const open = deals.filter((d) => openStages.includes(d.stage));
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const won = deals.filter((d) => d.stage === "CLOSED_WON" && d.closedAt && d.closedAt >= yearStart);

    return NextResponse.json({
      deals,
      summary: {
        openCount: open.length,
        openValue: open.reduce((s, d) => s + d.value, 0),
        openCommission: open.reduce((s, d) => s + d.commission, 0),
        wonCount: won.length,
        wonValue: won.reduce((s, d) => s + d.value, 0),
        wonCommission: won.reduce((s, d) => s + d.commission, 0),
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    const deal = await db.deal.create({ data: dealData(body) as Prisma.DealUncheckedCreateInput });
    return NextResponse.json({ deal });
  });
}
