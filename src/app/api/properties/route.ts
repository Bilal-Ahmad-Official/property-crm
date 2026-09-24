import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError, num } from "@/lib/api";
import { propertyData } from "@/lib/forms";
import { nextRef } from "@/lib/refs";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q");
    const type = sp.get("type");
    const status = sp.get("status");
    const listingType = sp.get("listingType");
    const featured = sp.get("featured");
    const sort = sp.get("sort") || "newest";

    const and: Prisma.PropertyWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { title: { contains: q } },
          { city: { contains: q } },
          { address: { contains: q } },
          { zip: { contains: q } },
        ],
      });
    }
    if (type) and.push({ type });
    if (status) and.push({ status });
    if (listingType) and.push({ listingType });
    if (featured === "true") and.push({ featured: true });
    const minPrice = num(sp.get("minPrice"));
    const maxPrice = num(sp.get("maxPrice"));
    if (minPrice !== undefined || maxPrice !== undefined) {
      and.push({ price: { gte: minPrice, lte: maxPrice } });
    }

    const orderBy: Prisma.PropertyOrderByWithRelationInput =
      sort === "price_asc" ? { price: "asc" } : sort === "price_desc" ? { price: "desc" } : { createdAt: "desc" };

    const properties = await db.property.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy,
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { leads: true, deals: true } },
      },
    });
    return NextResponse.json({ properties });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    const data = propertyData(body, true) as Prisma.PropertyUncheckedCreateInput;
    const property = await db.$transaction(async (tx) => {
      const ref = await nextRef(tx, "PRP");
      return tx.property.create({ data: { ...data, ref } });
    });
    return NextResponse.json({ property });
  });
}
