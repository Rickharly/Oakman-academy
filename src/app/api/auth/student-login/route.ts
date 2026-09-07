import { NextResponse } from "next/server";
import { loginStudent } from "@/lib/auth/login";
import { createSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { username, pin } = (body ?? {}) as { username?: unknown; pin?: unknown };
  if (typeof username !== "string" || typeof pin !== "string" || !username || !pin) {
    return NextResponse.json({ error: "username and pin are required" }, { status: 400 });
  }

  const user = await loginStudent(username, pin);
  if (!user) {
    return NextResponse.json({ error: "Invalid username or PIN" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
