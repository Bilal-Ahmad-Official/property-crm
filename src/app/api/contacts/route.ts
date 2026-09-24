import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { contactData } from "@/lib/forms";
import { nextRef } from "@/lib/refs";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const type = sp.get("type");

    const and: Prisma.ContactWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      });
    }
    if (type) and.push({ type });

    const contacts = await db.contact.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { leads: true, deals: true } } },
    });
    return NextResponse.json({ contacts });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const contact = await db.$transaction(async (tx) => {
      const ref = await nextRef(tx, "CNT");
      return tx.contact.create({
        data: { ...(contactData(body) as Prisma.ContactUncheckedCreateInput), ref },
      });
    });
    return NextResponse.json({ contact });
  });
}
