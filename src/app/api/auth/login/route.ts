import { NextResponse } from "next/server";
import { loginParent } from "@/lib/auth/login";
import { createSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  const user = await loginParent(email.trim().toLowerCase(), password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
