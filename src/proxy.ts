import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Keep in sync with SESSION_COOKIE in src/lib/auth/session.ts. Duplicated here
// (rather than imported) because proxy runs before routes render and must not
// depend on shared modules that reach Prisma — it only checks cookie
// presence. Role enforcement (parent vs student) happens in layouts/pages via
// requireParent()/requireStudent()/requireUser().
const SESSION_COOKIE = "fs_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  // Logged-in users hitting a login page: let the page itself decide where to
  // send them (it redirects away from /login and /student-login already).
  if (hasSession && (pathname === "/login" || pathname === "/student-login")) {
    return NextResponse.next();
  }

  if (!hasSession) {
    const destination = pathname.startsWith("/admin") ? "/login" : "/student-login";
    if (pathname !== destination) {
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/auth|login|student-login|favicon.ico|.*\\..*).*)"],
};
