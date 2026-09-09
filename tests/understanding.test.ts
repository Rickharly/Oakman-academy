import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { nextStrategy, parkOpenGaps, STRATEGY_ORDER } from "@/lib/lessons/understanding";

/**
 * The difference between a school and a tutor.
 *
 * A school marks the quiz and moves on. A tutor keeps working at the thing until it is
 * understood — and, crucially, never re-runs the explanation that already failed.
 */
describe("choosing how to explain it next", () => {
  it("never repeats an approach that has already failed", () => {
    expect(nextStrategy([])).toBe("SIMPLER");
    expect(nextStrategy(["SIMPLER"])).toBe("ANALOGY");
    expect(nextStrategy(["SIMPLER", "ANALOGY"])).toBe("WORKED_EXAMPLE");
  });

  it("gives up rather than going round again", () => {
    // Every angle tried and it has not landed. Saying the first thing again is not tutoring,
    // it is wearing a child down — so this returns null and the lesson parks it for tomorrow.
    expect(nextStrategy([...STRATEGY_ORDER])).toBeNull();
  });

  it("offers several genuinely different approaches before giving up", () => {
    expect(STRATEGY_ORDER.length).toBeGreaterThanOrEqual(4);
  });
});

async function buildGap() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: `u${Math.random().toString(36).slice(2, 8)}`, passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: `s${Math.random()}`, title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: `p${Math.random()}`, subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: `un${Math.random()}`, programmeId: programme.id, title: "Unit", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { provider: "test", providerSlug: `l${Math.random()}`, unitId: unit.id, title: "Fractions", order: 1 },
  });
  const attempt = await prisma.lessonAttempt.create({
    data: { studentId: student.id, lessonId: lesson.id, attemptNumber: 1, currentStage: "FEEDBACK" },
  });
  const gap = await prisma.understandingGap.create({
    data: {
      studentId: student.id,
      lessonId: lesson.id,
      lessonAttemptId: attempt.id,
      concept: "what the bottom number counts",
      misunderstanding: "thinks it counts the pieces taken",
    },
  });
  return { studentId: student.id, attemptId: attempt.id, gapId: gap.id };
}

describe("a gap the period ran out on", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("is parked and comes back tomorrow, never marked understood", async () => {
    const { studentId, attemptId, gapId } = await buildGap();

    expect(await parkOpenGaps(attemptId, studentId)).toBe(1);

    const gap = await prisma.understandingGap.findUniqueOrThrow({ where: { id: gapId } });
    // Parked, not understood. The whole point of finding a gap is that it counts for something.
    expect(gap.status).toBe("PARKED");

    const review = await prisma.reviewItem.findFirst({ where: { studentId } });
    expect(review).not.toBeNull();
    expect(review?.reason).toBe("MISCONCEPTION");
    expect(review?.detail).toContain("what the bottom number counts");
  });

  it("leaves a gap already understood alone", async () => {
    const { studentId, attemptId, gapId } = await buildGap();
    await prisma.understandingGap.update({ where: { id: gapId }, data: { status: "UNDERSTOOD" } });

    expect(await parkOpenGaps(attemptId, studentId)).toBe(0);
    expect(await prisma.reviewItem.count({ where: { studentId } })).toBe(0);
  });
});
