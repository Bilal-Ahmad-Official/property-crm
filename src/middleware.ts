import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "property-crm-dev-secret-change-me"
);
const SESSION_COOKIE = "crm_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, secret);
      valid = true;
    } catch {
      valid = false;
    }
  }

  // /login always renders the form — never bounce it back to "/" here. A JWT can be
  // signature-valid while the session no longer resolves (e.g. user deleted / DB reset),
  // and redirecting on signature alone causes an infinite "/" ↔ "/login" loop.
  // The app layout does the DB-backed check and redirects to /login only once.
  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!valid) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml|map|js|css)$).*)",
  ],
};
