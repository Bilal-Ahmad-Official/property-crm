import { NextResponse } from "next/server";
import { AuthError, ForbiddenError } from "./auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a route handler with uniform auth + error handling. */
export async function handle(
  fn: () => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return jsonError("Unauthorized", 401);
    if (e instanceof ForbiddenError) return jsonError(e.message, 403);
    const message = e instanceof Error ? e.message : "Something went wrong";
    console.error("[api]", e);
    return jsonError(message, 500);
  }
}

/** Parse a numeric query param with a fallback. */
export function num(value: string | null | undefined, fallback?: number): number | undefined {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse an ISO date query param with a fallback. */
export function date(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
