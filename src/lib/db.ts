import fs from "fs";
import os from "os";
import path from "path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Serverless hosts (Vercel) run functions on a read-only filesystem where
// SQLite cannot open or journal a database file, so the bundled database is
// copied into the writable temp directory and opened from there.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

function databaseUrl(): string {
  // The schema declares provider "sqlite", so Prisma rejects any DATABASE_URL
  // that does not start with file: (e.g. a Postgres URL set in the hosting
  // dashboard). Only file: URLs are honored; anything else is ignored.
  const configured = process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL
    : undefined;

  const sourceDb = path.join(process.cwd(), "prisma", "dev.db");
  if (!isServerless) return configured ?? `file:${sourceDb}`;

  const runtimeDb = path.join(os.tmpdir(), "property-crm.db");
  if (!fs.existsSync(runtimeDb)) fs.copyFileSync(sourceDb, runtimeDb);
  return `file:${runtimeDb.replace(/\\/g, "/")}`;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    datasourceUrl: databaseUrl(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
