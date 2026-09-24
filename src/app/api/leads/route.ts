import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, num } from "@/lib/api";
import { leadData } from "@/lib/forms";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const status = sp.get("status");
    const source = sp.get("source");

    const and: Prisma.LeadWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { interest: { contains: q } },
        ],
      });
    }
    if (status) and.push({ status });
    if (source) and.push({ source });

    const leads = await db.lead.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: [{ createdAt: "desc" }],
      include: {
        property: { select: { id: true, title: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { deals: true } },
      },
    });
    return NextResponse.json({ leads });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const lead = await db.lead.create({ data: leadData(body) as Prisma.LeadUncheckedCreateInput });
    return NextResponse.json({ lead });
  });
}
