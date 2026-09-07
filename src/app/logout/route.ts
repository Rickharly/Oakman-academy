import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

/**
 * Ends the session and returns to the login page.
 *
 * The redirect is 303 See Other, not the default 307: a 307 preserves the request method, so
 * a browser submitting the log-out form would re-POST to `/login` instead of loading it, and
 * the page would fail to render. 303 tells the browser to follow with GET.
 */
async function handleLogout(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

export async function POST(request: Request) {
  return handleLogout(request);
}

export async function GET(request: Request) {
  return handleLogout(request);
}
