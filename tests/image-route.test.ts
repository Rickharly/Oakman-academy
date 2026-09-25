import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { GET } from "@/app/api/curriculum/image/route";
import { resetDb } from "./helpers/db";

/**
 * The image proxy used to 404 anything that wasn't already an absolute `http(s)://` link, while
 * a stored `{url: "fixture://…"}` marker (placeholder curriculum, no real image behind it) was
 * treated by `unanswerable.ts` as proof a picture existed. Together those meant a relative Oak
 * asset link never loaded, and a fixture placeholder never got flagged as the missing picture it
 * actually is.
 */
describe("serving a question's picture", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let token: string;
  let questionId: string;
  let fixtureQuestionId: string;

  beforeEach(async () => {
    await resetDb();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    const passwordHash = await hashPassword("1234");
    const user = await prisma.user.create({
      data: { role: Role.STUDENT, username: "eva", passwordHash, displayName: "Eva", avatar: "🦊" },
    });
    await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 5, keyStage: "ks2" } });
    const token_ = randomBytes(32).toString("base64url");
    await prisma.session.create({
      data: {
        tokenHash: createHash("sha256").update(token_).digest("hex"),
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    token = token_;

    const subject = await prisma.subject.create({ data: { slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: { providerSlug: "maths:5", subjectId: subject.id, yearGroup: 5, keyStage: "ks2", title: "Maths — Year 5" },
    });
    const unit = await prisma.unit.create({
      data: { providerSlug: "shapes", programmeId: programme.id, title: "Shapes", order: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: { providerSlug: "quadrilaterals", unitId: unit.id, title: "Quadrilaterals", order: 1 },
    });

    const question = await prisma.question.create({
      data: {
        lessonId: lesson.id,
        source: "OAK_STARTER_QUIZ",
        stage: "STARTER",
        order: 1,
        type: "MULTIPLE_CHOICE",
        prompt: "Which shape is shown in the picture?",
        // Not absolute — the same shape Oak's own asset links arrive in.
        promptImage: { url: "assets/shapes/square.png", width: 100, height: 100 },
        options: { choices: [{ id: "a", text: "Square" }, { id: "b", text: "Circle" }] },
        answerKey: { correctOptionId: "a" },
        maxScore: 1,
        gradingMode: "DETERMINISTIC",
      },
    });
    questionId = question.id;

    const fixtureQuestion = await prisma.question.create({
      data: {
        lessonId: lesson.id,
        source: "OAK_STARTER_QUIZ",
        stage: "STARTER",
        order: 2,
        type: "MULTIPLE_CHOICE",
        prompt: "What shape is this?",
        // Bundled fixture curriculum's placeholder — never a real, fetchable image.
        promptImage: { url: "fixture://images/square.png" },
        options: { choices: [{ id: "a", text: "Square" }, { id: "b", text: "Circle" }] },
        answerKey: { correctOptionId: "a" },
        maxScore: 1,
        gradingMode: "DETERMINISTIC",
      },
    });
    fixtureQuestionId = fixtureQuestion.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function request(qId: string) {
    return GET(
      new Request(`http://localhost/api/curriculum/image?question=${qId}`, {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
  }

  it("resolves a relative promptImage url against the Oak base rather than 404ing it", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bytes", { status: 200, headers: { "content-type": "image/png" } }));

    const res = await request(questionId);

    expect(res.status).toBe(200);
    const [calledUrl] = fetchMock.mock.calls[0]!;
    expect(String(calledUrl)).toBe("https://open-api.thenational.academy/api/v0/assets/shapes/square.png");
  });

  it("treats a fixture:// placeholder as no picture at all, rather than fetching it", async () => {
    const res = await request(fixtureQuestionId);

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });
});
