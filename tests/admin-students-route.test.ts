import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { POST } from "@/app/api/admin/students/route";
import { resetDb } from "./helpers/db";

/**
 * Regression test for commit eed2064: the "create student" PIN field only checked length
 * (`min(4).max(6)`), so a PIN of letters passed validation even though the student login
 * screen only has a number pad. It is now `/^\d{4,6}$/`.
 */

async function createParentSession() {
  const parent = await prisma.user.create({
    data: { role: "PARENT", email: "parent@example.com", passwordHash: "x", displayName: "Parent" },
  });
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: { tokenHash, userId: parent.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  return token;
}

function postAs(token: string, body: unknown) {
  return new Request("http://localhost/api/admin/students", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE}=${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/students: PIN must be digits", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects a non-numeric PIN like 'abcd'", async () => {
    const token = await createParentSession();
    const res = await POST(
      postAs(token, {
        action: "create",
        displayName: "New Student",
        username: "new-student",
        pin: "abcd",
        yearGroup: 7,
        keyStage: "ks3",
      }),
    );

    expect(res.status).not.toBe(200);
    // The rejected student must never have been created.
    expect(await prisma.user.findUnique({ where: { username: "new-student" } })).toBeNull();
  });

  it("accepts a 4-digit numeric PIN like '1234'", async () => {
    const token = await createParentSession();
    const res = await POST(
      postAs(token, {
        action: "create",
        displayName: "New Student",
        username: "new-student",
        pin: "1234",
        yearGroup: 7,
        keyStage: "ks3",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.student.user.username).toBe("new-student");
    expect(await prisma.user.findUnique({ where: { username: "new-student" } })).not.toBeNull();
  });
});
