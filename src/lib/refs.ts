import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Generates a unique, human-readable business reference (SRS §6) such as
 * BKG-2026-0001, inside the caller's transaction so concurrent creates stay unique.
 */
export async function nextRef(tx: Tx, prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const counter = await tx.counter.upsert({
    where: { id: key },
    create: { id: key, seq: 1 },
    update: { seq: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(counter.seq).padStart(4, "0")}`;
}
