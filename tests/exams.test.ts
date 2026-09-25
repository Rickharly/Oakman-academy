import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { buildExam, getExamForStudent, saveExamAnswer, submitExam } from "@/lib/exams/service";
import { ensureExamForDay } from "@/lib/exams/schedule";
import { toDateOnly } from "@/lib/dates";

/**
 * An exam is the one place the app finds out what a child can do unaided. These hold it to
 * that: only work they were actually taught, marked without help, and every topic they missed
 * turned into work rather than into a number in a report.
 */
const FRIDAY = "2026-09-25";

async function buildStudentWhoHasStudied(lessonCount = 3) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3", lessonsPerDay: 5 },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: "maths:7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: "u1", programmeId: programme.id, title: "Unit", order: 1 },
  });

  const lessons = [];
  for (let i = 1; i <= lessonCount; i++) {
    const lesson = await prisma.lesson.create({
      data: { provider: "test", providerSlug: `l${i}`, unitId: unit.id, title: `Topic ${i}`, order: i },
    });
    for (let q = 1; q <= 3; q++) {
      await prisma.question.create({
        data: {
          lessonId: lesson.id,
          source: "OAK_EXIT_QUIZ",
          stage: "CHECK",
          order: q,
          type: "TRUE_FALSE",
          prompt: `Topic ${i} question ${q}: is this true?`,
          options: {},
          answerKey: { value: true },
          maxScore: 1,
          gradingMode: "DETERMINISTIC",
          providerRef: `l${i}-q${q}`,
        },
      });
    }
    lessons.push(lesson);
  }
  return { studentId: student.id, lessons };
}

/** Marks every lesson as worked through, which is what makes it examinable. */
async function markStudied(studentId: string, lessonIds: string[], status = "COMPLETED") {
  for (const lessonId of lessonIds) {
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId, status: status as "COMPLETED", completedAt: new Date() },
    });
  }
}

describe("building an exam", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("only asks about lessons they were actually taught", async () => {
    const { studentId, lessons } = await buildStudentWhoHasStudied(3);
    await markStudied(studentId, [lessons[0].id, lessons[1].id]);

    const exam = await buildExam(studentId, {
      kind: "CATCH_UP",
      from: null,
      to: new Date(),
      title: "Everything so far",
    });
    expect(exam).not.toBeNull();

    const rows = await prisma.examQuestion.findMany({ where: { examId: exam!.id } });
    const examined = new Set(rows.map((r) => r.lessonId));
    // The third topic was never reached. Testing someone on material nobody gave them teaches
    // them the number is about them rather than about the work.
    expect(examined.has(lessons[2].id)).toBe(false);
    expect(examined.size).toBe(2);
  });

  it("never examines a lesson the child said they already knew", async () => {
    const { studentId, lessons } = await buildStudentWhoHasStudied(2);
    await markStudied(studentId, [lessons[0].id]);
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: lessons[1].id, status: "ALREADY_KNOWN", completedAt: new Date() },
    });

    const exam = await buildExam(studentId, { kind: "CATCH_UP", from: null, to: new Date(), title: "T" });
    const rows = await prisma.examQuestion.findMany({ where: { examId: exam!.id } });
    expect(rows.every((r) => r.lessonId === lessons[0].id)).toBe(true);
  });

  it("hands nothing back when there is no studied work, rather than an empty paper", async () => {
    const { studentId } = await buildStudentWhoHasStudied(2);
    const exam = await buildExam(studentId, { kind: "WEEKLY", from: new Date(), to: new Date(), title: "T" });
    expect(exam).toBeNull();
  });

  it("spreads across topics instead of dwelling on one", async () => {
    const { studentId, lessons } = await buildStudentWhoHasStudied(3);
    await markStudied(studentId, lessons.map((l) => l.id));

    const exam = await buildExam(studentId, { kind: "CATCH_UP", from: null, to: new Date(), title: "T" });
    const rows = await prisma.examQuestion.findMany({ where: { examId: exam!.id } });
    const perLesson = new Map<string, number>();
    for (const row of rows) perLesson.set(row.lessonId, (perLesson.get(row.lessonId) ?? 0) + 1);
    expect(perLesson.size).toBe(3);
    expect(Math.max(...perLesson.values())).toBeLessThanOrEqual(2);
  });
});

describe("sitting and marking an exam", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("never sends the answer key to the child", async () => {
    const { studentId, lessons } = await buildStudentWhoHasStudied(1);
    await markStudied(studentId, [lessons[0].id]);
    const exam = await buildExam(studentId, { kind: "CATCH_UP", from: null, to: new Date(), title: "T" });

    const { questions } = await getExamForStudent(exam!.id, studentId);
    expect(questions.length).toBeGreaterThan(0);
    for (const question of questions) {
      expect(JSON.stringify(question)).not.toContain("answerKey");
    }
  });

  it("marks the paper, gives a letter, and sends every missed topic back as work", async () => {
    const { studentId, lessons } = await buildStudentWhoHasStudied(2);
    await markStudied(studentId, lessons.map((l) => l.id));
    const exam = await buildExam(studentId, { kind: "CATCH_UP", from: null, to: new Date(), title: "Everything so far" });

    const rows = await prisma.examQuestion.findMany({
      where: { examId: exam!.id },
      orderBy: { order: "asc" },
    });
    // Right on everything from the first topic, wrong on everything from the second.
    for (const row of rows) {
      const correct = row.lessonId === lessons[0].id;
      await saveExamAnswer(row.id, studentId, { value: correct });
    }

    const result = await submitExam(exam!.id, studentId);
    expect(result.grade).toBeTruthy();
    expect(result.scorePct).toBeGreaterThan(0);
    expect(result.scorePct).toBeLessThan(100);

    const weak = result.weakTopics.map((t) => t.lessonTitle);
    expect(weak).toContain("Topic 2");
    expect(weak).not.toContain("Topic 1");

    // The whole point: a wrong answer on Friday is a piece of work next week, not a line in a
    // report nobody acts on.
    const review = await prisma.reviewItem.findFirst({
      where: { studentId, lessonId: lessons[1].id, status: "PENDING" },
    });
    expect(review).not.toBeNull();

    const saved = await prisma.exam.findUniqueOrThrow({ where: { id: exam!.id } });
    expect(saved.status).toBe("GRADED");
    expect(saved.grade).toBe(result.grade);
  });
});

describe("exam day", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("puts the first exam on a Friday, covering everything so far", async () => {
    const { studentId, lessons } = await buildStudentWhoHasStudied(2);
    await markStudied(studentId, lessons.map((l) => l.id));

    await ensureExamForDay(studentId, FRIDAY);

    const assignment = await prisma.dailyAssignment.findFirst({
      where: { studentId, date: toDateOnly(FRIDAY), kind: "EXAM" },
    });
    expect(assignment).not.toBeNull();
    expect(assignment!.examId).not.toBeNull();

    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: assignment!.examId! } });
    expect(exam.kind).toBe("CATCH_UP");
    expect(exam.coversFrom).toBeNull();
  });

  it("does not set one twice, and does not set one on a Tuesday", async () => {
    const { studentId, lessons } = await buildStudentWhoHasStudied(2);
    await markStudied(studentId, lessons.map((l) => l.id));

    await ensureExamForDay(studentId, FRIDAY);
    await ensureExamForDay(studentId, FRIDAY);
    await ensureExamForDay(studentId, "2026-09-22"); // a Tuesday

    const all = await prisma.dailyAssignment.findMany({ where: { studentId, kind: "EXAM" } });
    expect(all).toHaveLength(1);
  });
});

describe("after the paper is handed in", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("ticks the period on the board", async () => {
    // Handing in a paper and having the day still say "Start" is the same fault the lessons
    // had: the work was done and the record said otherwise.
    const { studentId, lessons } = await buildStudentWhoHasStudied(2);
    await markStudied(studentId, lessons.map((l) => l.id));
    await ensureExamForDay(studentId, FRIDAY);

    const assignment = await prisma.dailyAssignment.findFirstOrThrow({
      where: { studentId, kind: "EXAM" },
    });
    expect(assignment.status).toBe("PLANNED");

    await submitExam(assignment.examId!, studentId);

    const after = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after.status).toBe("COMPLETED");
    expect(after.completedAt).not.toBeNull();
  });

  it("hands back the questions they got wrong, not just the topics", async () => {
    const { studentId, lessons } = await buildStudentWhoHasStudied(2);
    await markStudied(studentId, lessons.map((l) => l.id));
    const exam = await buildExam(studentId, { kind: "CATCH_UP", from: null, to: new Date(), title: "T" });

    const rows = await prisma.examQuestion.findMany({ where: { examId: exam!.id } });
    for (const row of rows) {
      await saveExamAnswer(row.id, studentId, { value: row.lessonId === lessons[0].id });
    }

    const result = await submitExam(exam!.id, studentId);
    expect(result.missed.length).toBeGreaterThan(0);
    // The question itself, with its words — something a child can actually be asked again.
    expect(result.missed.every((m) => m.prompt.length > 0)).toBe(true);
    expect(result.missed.every((m) => m.lessonId === lessons[1].id)).toBe(true);

    // And the review carries the specific question, so what comes back is what went wrong.
    const review = await prisma.reviewItem.findFirstOrThrow({
      where: { studentId, lessonId: lessons[1].id, status: "PENDING" },
    });
    expect(review.questionId).not.toBeNull();
    expect(review.detail).toContain("Ask again:");
  });
});
