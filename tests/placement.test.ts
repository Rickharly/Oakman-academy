import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { buildPlacementExam, readPlacement } from "@/lib/exams/placement";

/**
 * A child who gets everything right has told you the work is too easy and nothing else — never
 * how much too easy. The placement paper is a ladder past what they have been taught and into
 * next year, and the band where they stop is the answer.
 */
async function buildLadder() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "mikhael", passwordHash: "x", displayName: "Mikhael" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 4, keyStage: "ks2" },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });

  const lessonsByYear: Record<number, { id: string }[]> = {};
  for (const year of [4, 5]) {
    const programme = await prisma.programme.create({
      data: {
        provider: "test",
        providerSlug: `maths:${year}`,
        subjectId: subject.id,
        yearGroup: year,
        keyStage: "ks2",
        title: `Maths Y${year}`,
      },
    });
    const unit = await prisma.unit.create({
      data: { provider: "test", providerSlug: `u${year}`, programmeId: programme.id, title: "U", order: 1 },
    });
    lessonsByYear[year] = [];
    for (let i = 1; i <= 20; i++) {
      const lesson = await prisma.lesson.create({
        data: {
          provider: "test",
          providerSlug: `y${year}-l${i}`,
          unitId: unit.id,
          title: `Y${year} topic ${i}`,
          order: i,
        },
      });
      for (let q = 1; q <= 2; q++) {
        await prisma.question.create({
          data: {
            lessonId: lesson.id,
            source: "OAK_EXIT_QUIZ",
            stage: "CHECK",
            order: q,
            type: "TRUE_FALSE",
            prompt: `Y${year} topic ${i} question ${q}`,
            options: {},
            answerKey: { value: true },
            maxScore: 1,
            gradingMode: "DETERMINISTIC",
            providerRef: `y${year}-l${i}-q${q}`,
          },
        });
      }
      lessonsByYear[year].push(lesson);
    }
  }

  // Six topics of Year 4 behind them, so there is a "already done" band to draw on.
  for (const lesson of lessonsByYear[4].slice(0, 6)) {
    await prisma.studentLessonProgress.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "COMPLETED", completedAt: new Date() },
    });
  }

  return { studentId: student.id, lessonsByYear };
}

describe("a paper that finds their level", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("climbs from work behind them to next year's", async () => {
    const { studentId } = await buildLadder();

    const exam = await buildPlacementExam(studentId, "maths");
    expect(exam).not.toBeNull();
    expect(exam!.kind).toBe("PLACEMENT");

    const rows = await prisma.examQuestion.findMany({ where: { examId: exam!.id } });
    const bands = new Set(rows.map((r) => r.band));
    // All four rungs: already done, where they are, later this year, next year.
    expect([...bands].sort()).toEqual([0, 1, 2, 3]);
  });

  it("asks next year's questions from next year's programme", async () => {
    const { studentId, lessonsByYear } = await buildLadder();
    const exam = await buildPlacementExam(studentId, "maths");

    const rows = await prisma.examQuestion.findMany({ where: { examId: exam!.id } });
    const yearFiveIds = new Set(lessonsByYear[5].map((l) => l.id));
    const topBand = rows.filter((r) => r.band === 3);
    expect(topBand.length).toBeGreaterThan(0);
    expect(topBand.every((r) => yearFiveIds.has(r.lessonId))).toBe(true);
  });

  it("names the band where they stopped, not just a score", async () => {
    const { studentId } = await buildLadder();
    const exam = await buildPlacementExam(studentId, "maths");
    const rows = await prisma.examQuestion.findMany({ where: { examId: exam!.id } });

    // Solid through this year, falls apart on next year's work — the shape we expect from a
    // child who is a year ahead of where he is being taught.
    for (const row of rows) {
      await prisma.examQuestion.update({
        where: { id: row.id },
        data: { isCorrect: (row.band ?? 0) < 3, score: (row.band ?? 0) < 3 ? 1 : 0 },
      });
    }

    const verdict = await readPlacement(exam!.id);
    expect(verdict.solidTo).toBe(2);
    expect(verdict.brokeAt).toBe(3);
    expect(verdict.recommendation).toMatch(/Push them further along/);
  });

  it("says move them up a year when nothing stops them", async () => {
    const { studentId } = await buildLadder();
    const exam = await buildPlacementExam(studentId, "maths");
    await prisma.examQuestion.updateMany({
      where: { examId: exam!.id },
      data: { isCorrect: true, score: 1 },
    });

    const verdict = await readPlacement(exam!.id);
    expect(verdict.brokeAt).toBe(-1);
    expect(verdict.recommendation).toMatch(/Move them up a year/);
  });

  it("refuses to produce a level from a paper too thin to mean anything", async () => {
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "thin", passwordHash: "x", displayName: "Thin" },
    });
    const student = await prisma.studentProfile.create({
      data: { userId: user.id, yearGroup: 4, keyStage: "ks2" },
    });
    const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: { provider: "test", providerSlug: "maths:4", subjectId: subject.id, yearGroup: 4, keyStage: "ks2", title: "M" },
    });
    const unit = await prisma.unit.create({
      data: { provider: "test", providerSlug: "u", programmeId: programme.id, title: "U", order: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: { provider: "test", providerSlug: "only", unitId: unit.id, title: "The only topic", order: 1 },
    });
    await prisma.question.create({
      data: {
        lessonId: lesson.id,
        source: "OAK_EXIT_QUIZ",
        stage: "CHECK",
        order: 1,
        type: "TRUE_FALSE",
        prompt: "The only question",
        options: {},
        answerKey: { value: true },
        maxScore: 1,
        gradingMode: "DETERMINISTIC",
        providerRef: "only-q1",
      },
    });

    // A ladder with one rung measures nothing, and saying so beats producing a number.
    expect(await buildPlacementExam(student.id, "maths")).toBeNull();
  });
});
