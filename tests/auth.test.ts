import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { loginParent, loginStudent, listStudentAvatars } from "@/lib/auth/login";
import { sessionTtlMs } from "@/lib/auth/session";
import { getSessionFromRequest, SESSION_COOKIE } from "@/lib/auth/session";
import { resetDb } from "./helpers/db";

/**
 * Mirrors createSession()'s token scheme without touching next/headers'
 * cookies() — that API throws outside a real request scope, so these tests
 * exercise the DB-backed lookup (getSessionFromRequest) directly instead.
 */
async function createTestSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: { tokenHash, userId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  return token;
}

describe("auth", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("logs a parent in with the right password and rejects everything else", async () => {
    const passwordHash = await hashPassword("parent1234");
    const parent = await prisma.user.create({
      data: { role: Role.PARENT, email: "parent@example.com", passwordHash, displayName: "Robin Parent" },
    });

    const ok = await loginParent("parent@example.com", "parent1234");
    expect(ok?.id).toBe(parent.id);

    const wrongPassword = await loginParent("parent@example.com", "not-the-password");
    expect(wrongPassword).toBeNull();

    const unknownEmail = await loginParent("nobody@example.com", "whatever");
    expect(unknownEmail).toBeNull();
  });

  it("logs a student in with username + PIN and rejects a wrong PIN", async () => {
    const passwordHash = await hashPassword("4821");
    const student = await prisma.user.create({
      data: { role: Role.STUDENT, username: "ada", passwordHash, displayName: "Ada", avatar: "🦊" },
    });
    await prisma.studentProfile.create({
      data: { userId: student.id, yearGroup: 7, keyStage: "ks3" },
    });

    const ok = await loginStudent("ada", "4821");
    expect(ok?.id).toBe(student.id);

    const wrongPin = await loginStudent("ada", "0000");
    expect(wrongPin).toBeNull();

    const unknownUsername = await loginStudent("nobody", "4821");
    expect(unknownUsername).toBeNull();
  });

  it("a parent's password does not double as a student's PIN and vice versa", async () => {
    const parentHash = await hashPassword("sharedSecret1");
    await prisma.user.create({
      data: { role: Role.PARENT, email: "shared@example.com", passwordHash: parentHash, displayName: "Parent" },
    });

    // A STUDENT lookup for the parent's username field (null) must never match.
    expect(await loginStudent("shared@example.com", "sharedSecret1")).toBeNull();
  });

  it("lists student avatars for the picker without leaking secrets", async () => {
    const passwordHash = await hashPassword("1234");
    await prisma.user.create({
      data: { role: Role.STUDENT, username: "beau", passwordHash, displayName: "Beau", avatar: "🐢" },
    });
    // A parent must never show up in the student avatar list.
    await prisma.user.create({
      data: {
        role: Role.PARENT,
        email: "parent2@example.com",
        passwordHash: await hashPassword("whatever"),
        displayName: "Parent Two",
      },
    });

    const avatars = await listStudentAvatars();
    expect(avatars).toEqual([{ username: "beau", displayName: "Beau", avatar: "🐢" }]);
    expect(JSON.stringify(avatars)).not.toContain("1234");
    expect(JSON.stringify(avatars)).not.toContain(passwordHash);
  });

  it("resolves a session token to the right student user, profile, and parent link", async () => {
    const parentHash = await hashPassword("parent1234");
    const parent = await prisma.user.create({
      data: {
        role: Role.PARENT,
        email: "family@example.com",
        passwordHash: parentHash,
        displayName: "Robin Parent",
      },
    });

    const studentHash = await hashPassword("7777");
    const studentUser = await prisma.user.create({
      data: { role: Role.STUDENT, username: "sam", passwordHash: studentHash, displayName: "Sam", avatar: "🦕" },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: studentUser.id, yearGroup: 5, keyStage: "ks2" },
    });
    await prisma.parentStudentLink.create({
      data: { parentId: parent.id, studentId: studentUser.id },
    });

    const token = await createTestSession(studentUser.id);
    const req = new Request("http://localhost/api/whatever", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });

    const sessionUser = await getSessionFromRequest(req);
    expect(sessionUser).not.toBeNull();
    expect(sessionUser?.id).toBe(studentUser.id);
    expect(sessionUser?.role).toBe("STUDENT");
    expect(sessionUser?.username).toBe("sam");
    expect(sessionUser?.studentProfile?.id).toBe(profile.id);
    expect(sessionUser?.studentProfile?.yearGroup).toBe(5);
    expect(sessionUser?.studentProfile?.keyStage).toBe("ks2");

    // Parent/student linkage used by requireParentOfStudent.
    const link = await prisma.parentStudentLink.findUnique({
      where: { parentId_studentId: { parentId: parent.id, studentId: studentUser.id } },
    });
    expect(link).not.toBeNull();
  });

  it("returns null for a missing or unknown session token", async () => {
    const noCookie = new Request("http://localhost/api/whatever");
    expect(await getSessionFromRequest(noCookie)).toBeNull();

    const badCookie = new Request("http://localhost/api/whatever", {
      headers: { cookie: `${SESSION_COOKIE}=not-a-real-token` },
    });
    expect(await getSessionFromRequest(badCookie)).toBeNull();
  });

  it("treats an expired session as absent", async () => {
    const passwordHash = await hashPassword("parent1234");
    const parent = await prisma.user.create({
      data: { role: Role.PARENT, email: "expired@example.com", passwordHash, displayName: "Expired Parent" },
    });

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.session.create({
      data: { tokenHash, userId: parent.id, expiresAt: new Date(Date.now() - 1000) },
    });

    const req = new Request("http://localhost/api/whatever", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
    expect(await getSessionFromRequest(req)).toBeNull();
  });
});

describe("staying signed in", () => {
  const days = (ms: number) => ms / 86_400_000;

  it("keeps a remembered login for a term, not a month", () => {
    expect(days(sessionTtlMs(true))).toBeGreaterThan(90);
  });

  it("keeps an unticked login to a single day", () => {
    // A borrowed device should not stay signed in to a child's records for months.
    expect(days(sessionTtlMs(false))).toBeLessThan(2);
  });

  it("leaves an older client, which sends nothing, on the previous default", () => {
    expect(days(sessionTtlMs(undefined))).toBe(30);
  });
});
