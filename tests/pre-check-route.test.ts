import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { POST as preCheck } from "@/app/api/lessons/[lessonId]/pre-check/route";
import { resetDb } from "./helpers/db";

/**
 * The pre-check's total used to be the count of questions the child actually answered, not the
 * count shown — leaving some blank shrank the denominator along with the numerator, so getting
 * 3 of 4 right (by answering only those 3) read as a perfect score.
 */
describe("the pre-check is marked against everything shown, not just what was answered", () => {
  it("scores a question left blank as wrong, dropping the percentage rather than the total", async () => {
    await resetDb();

    const passwordHash = await hashPassword("1234");
    const user = await prisma.user.create({
      data: { role: Role.STUDENT, username: "pre-check-kid", passwordHash, displayName: "Eva", avatar: "🦊" },
    });
    const student = await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 5, keyStage: "ks2" } });
    const token = randomBytes(32).toString("base64url");
    await prisma.session.create({
      data: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const subject = await prisma.subject.create({ data: { slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: { providerSlug: "maths:5", subjectId: subject.id, yearGroup: 5, keyStage: "ks2", title: "Maths" },
    });
    const unit = await prisma.unit.create({
      data: { providerSlug: "fractions", programmeId: programme.id, title: "Fractions", order: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: { providerSlug: "halves", unitId: unit.id, title: "Halves", order: 1 },
    });

    const questions = await Promise.all(
      [0, 1, 2, 3].map((i) =>
        prisma.question.create({
          data: {
            lessonId: lesson.id,
            source: "OAK_EXIT_QUIZ",
            stage: "CHECK",
            order: i + 1,
            type: "MULTIPLE_CHOICE",
            prompt: `Question ${i}`,
            options: { choices: [{ id: "a", text: "Right" }, { id: "b", text: "Wrong" }] },
            answerKey: { correctOptionId: "a" },
            maxScore: 1,
            gradingMode: "DETERMINISTIC",
            providerRef: `q:${i}`,
          },
        }),
      ),
    );

    // Three of the four shown questions answered correctly; the fourth left untouched.
    const res = await preCheck(
      new Request(`http://localhost/api/lessons/${lesson.id}/pre-check`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
        body: JSON.stringify({
          answers: {
            [questions[0]!.id]: { optionId: "a" },
            [questions[1]!.id]: { optionId: "a" },
            [questions[2]!.id]: { optionId: "a" },
          },
        }),
      }),
      { params: Promise.resolve({ lessonId: lesson.id }) },
    );
    const body = (await res.json()) as { passed: boolean; scorePct: number; answered: number };

    expect(res.status).toBe(200);
    // Not "3 of 3 answered" (100%, and a pass): 3 of the 4 actually shown (75%, not a pass).
    expect(body.answered).toBe(4);
    expect(body.scorePct).toBe(75);
    expect(body.passed).toBe(false);

    // And no lesson was wrongly placed-out-of on the strength of a shrunken denominator.
    const progress = await prisma.studentLessonProgress.findFirst({ where: { studentId: student.id, lessonId: lesson.id } });
    expect(progress?.status).not.toBe("MASTERED");
  });
});
