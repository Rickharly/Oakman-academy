import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { POST } from "@/app/api/student/video-report/route";
import { runDiagnostics } from "@/lib/admin/diagnostics";
import { resetDb } from "./helpers/db";

/**
 * The evidence a child's own browser gives when a lesson video fails — the only thing that has
 * ever actually told anyone apart "the server can fetch this" from "a Chromebook can play it".
 */

async function makeStudent(username: string) {
  const passwordHash = await hashPassword("1234");
  const user = await prisma.user.create({
    data: { role: Role.STUDENT, username, passwordHash, displayName: username, avatar: "🦊" },
  });
  const profile = await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 5, keyStage: "ks2" } });
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return { studentId: profile.id, token };
}

async function makeLesson() {
  const subject = await prisma.subject.create({ data: { slug: `s-${Math.random()}`, title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { providerSlug: `p-${Math.random()}`, subjectId: subject.id, yearGroup: 5, keyStage: "ks2", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { providerSlug: `u-${Math.random()}`, programmeId: programme.id, title: "Fractions", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { providerSlug: `l-${Math.random()}`, unitId: unit.id, title: "Halving", order: 1 },
  });
  const video = await prisma.lessonResource.create({
    data: { lessonId: lesson.id, type: "VIDEO", label: "Video", providerUrl: "https://open-api.thenational.academy/api/v0/lessons/halving/assets/video" },
  });
  return { lesson, video };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/student/video-report", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    lessonId: "lesson-1",
    resourceId: "resource-1",
    videoState: "a real video that would not play in the browser (network error)",
    userAgent: "Mozilla/5.0 (X11; CrOS x86_64 15633.69.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    elementErrorCode: 2,
    elementErrorMessage: "network error",
    probe: {
      status: 200,
      contentType: "application/json",
      contentLength: "42",
      contentRange: null,
      acceptRanges: null,
      redirected: false,
      responseType: "basic",
      urlHost: "open-api.thenational.academy",
      bodySnippet: "7b 22 65 72 72 6f 72 22 3a | {\"error\":",
      networkErrorName: null,
      networkErrorMessage: null,
    },
    ...overrides,
  };
}

describe("a child's own browser reporting a video failure", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("requires a student session", async () => {
    const res = await request(validBody());
    expect(res.status).toBe(401);
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it("refuses a parent session — this is a student's own report", async () => {
    const passwordHash = await hashPassword("1234");
    const parent = await prisma.user.create({
      data: { role: Role.PARENT, username: "parent", passwordHash, displayName: "Parent" },
    });
    const token = randomBytes(32).toString("base64url");
    await prisma.session.create({
      data: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        userId: parent.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const res = await request(validBody(), { cookie: `${SESSION_COOKIE}=${token}` });
    expect(res.status).toBe(403);
  });

  it("stores a report under the reporting student and it comes back in the diagnostics section", async () => {
    const { lesson, video } = await makeLesson();
    const { studentId, token } = await makeStudent("eva");

    const res = await request(
      validBody({ lessonId: lesson.id, resourceId: video.id }),
      { cookie: `${SESSION_COOKIE}=${token}` },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const logs = await prisma.activityLog.findMany({ where: { kind: "video_report" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.studentId).toBe(studentId);
    const data = logs[0]!.data as Record<string, unknown>;
    expect(data.lessonId).toBe(lesson.id);
    expect(data.resourceId).toBe(video.id);

    const checks = await runDiagnostics();
    const check = checks.find((c) => c.name === "What children's browsers actually got (video)");
    expect(check).toBeDefined();
    expect(check!.status).toBe("warn");
    expect(check!.detail).toContain("eva");
    expect(check!.detail).toContain(lesson.title);
    expect(check!.detail).toContain("Chrome on ChromeOS");
    expect(check!.detail).toContain("network error");
  });

  it("scopes each report to the student who sent it, not any other child's", async () => {
    const { lesson, video } = await makeLesson();
    const a = await makeStudent("student-a");
    const b = await makeStudent("student-b");

    await request(validBody({ lessonId: lesson.id, resourceId: video.id }), {
      cookie: `${SESSION_COOKIE}=${a.token}`,
    });

    const logs = await prisma.activityLog.findMany({ where: { kind: "video_report" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.studentId).toBe(a.studentId);
    expect(logs[0]!.studentId).not.toBe(b.studentId);
  });

  it("rejects a malformed body", async () => {
    const { token } = await makeStudent("eva");
    const res = await request({ lessonId: "x" }, { cookie: `${SESSION_COOKIE}=${token}` });
    expect(res.status).toBe(400);
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it("rejects an oversized body", async () => {
    const { token } = await makeStudent("eva");
    const res = await request(
      validBody({ elementErrorMessage: "x".repeat(50_000) }),
      { cookie: `${SESSION_COOKIE}=${token}` },
    );
    expect(res.status).toBe(413);
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it("never persists a signed query string, however it arrives", async () => {
    const { lesson, video } = await makeLesson();
    const { token } = await makeStudent("eva");

    const res = await request(
      validBody({
        lessonId: lesson.id,
        resourceId: video.id,
        probe: {
          ...validBody().probe,
          // A hostile or buggy client handing over a whole signed URL instead of a bare host.
          urlHost: "https://storage.googleapis.com/oak/halves.mp4?X-Goog-Signature=super-secret-token",
        },
      }),
      { cookie: `${SESSION_COOKIE}=${token}` },
    );
    expect(res.status).toBe(200);

    const log = await prisma.activityLog.findFirstOrThrow({ where: { kind: "video_report" } });
    const data = log.data as Record<string, unknown>;
    const probe = data.probe as Record<string, unknown>;
    expect(probe.urlHost).toBe("storage.googleapis.com");
    expect(JSON.stringify(data)).not.toContain("X-Goog-Signature");
    expect(JSON.stringify(data)).not.toContain("super-secret-token");
  });
});
