import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "property-crm-dev-secret-change-me"
);

export const SESSION_COOKIE = "crm_session";
const SESSION_DAYS = 7;

export async function createSessionToken(userId: string): Promise<string> {
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.sub;
    if (!userId) return null;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  } catch {
    return null;
  }
}

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError();
  return user;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
  }
}

/** Requires an authenticated user holding one of the given roles (SRS §8 role-based access). */
export async function requireRole(roles: readonly string[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return user;
}
