import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

async function handleLogout(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: Request) {
  return handleLogout(request);
}

export async function GET(request: Request) {
  return handleLogout(request);
}
