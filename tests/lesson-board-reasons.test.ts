import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { whyLessonsRepeatCheck } from "@/lib/admin/diagnostics";
import { addDaysKey, dateOnlyKey, todayDateOnly, toDateOnly } from "@/lib/dates";

/**
 * "Why these lessons are on the board" exists because every guess at why a lesson keeps
 * reappearing — made by reading `planWeek` instead of looking at a real child's rows — has been
 * wrong. These tests build each real shape of "still here" and hold the check to naming the
 * right one, at the right severity: genuinely new work is `ok`, a repeat explained by unfinished
 * work is `warn`, and a repeat where the attempt says done but the progress row disagrees is
 * `fail`, because that one is a bug and not a fact about the child.
 */

const TODAY = todayDateOnly();
const YESTERDAY_KEY = addDaysKey(dateOnlyKey(TODAY), -1);

let n = 0;
function uniq(prefix: string): string {
  n += 1;
  return `${prefix}-${n}`;
}

async function makeStudent(displayName = "Rich") {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: uniq("student"), passwordHash: "x", displayName },
  });
  return prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 7, keyStage: "ks3" } });
}

/** A subject/programme/unit/lesson trio, isolated per case so cases never collide. */
async function makeLesson(title = "Fractions: Halves") {
  const slug = uniq("subj");
  const subject = await prisma.subject.create({ data: { provider: "test", slug, title: slug } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: `${slug}:7`, subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: slug },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: `${slug}-u1`, programmeId: programme.id, title: "Unit", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { provider: "test", providerSlug: `${slug}-l1`, unitId: unit.id, title, order: 1 },
  });
  return { subject, programme, unit, lesson };
}

async function makeTodayAssignment(studentId: string, subjectId: string, lessonId: string) {
  return prisma.dailyAssignment.create({
    data: {
      studentId,
      date: TODAY,
      order: 0,
      kind: "LESSON",
      source: "AUTO",
      status: "PLANNED",
      subjectId,
      lessonId,
      estimatedMinutes: 45,
    },
  });
}

async function makePastAssignment(studentId: string, subjectId: string, lessonId: string, dateKey: string) {
  return prisma.dailyAssignment.create({
    data: {
      studentId,
      date: toDateOnly(dateKey),
      order: 0,
      kind: "LESSON",
      source: "AUTO",
      status: "COMPLETED",
      subjectId,
      lessonId,
      estimatedMinutes: 45,
    },
  });
}

describe("why lessons repeat: a genuinely new lesson", () => {
  let check: Awaited<ReturnType<typeof whyLessonsRepeatCheck>>;

  beforeAll(async () => {
    await resetDb();
    const student = await makeStudent();
    const { subject, lesson } = await makeLesson("Fractions: Halves");
    await makeTodayAssignment(student.id, subject.id, lesson.id);
    // Deliberately: no LessonAttempt, no StudentLessonProgress, no earlier assignment.

    check = await whyLessonsRepeatCheck();
  });

  it("is ok — a board of genuinely new lessons is not a problem", () => {
    expect(check.status).toBe("ok");
  });

  it("says plainly it is new", () => {
    expect(check.detail).toContain("Fractions: Halves");
    expect(check.detail).toContain("new");
    expect(check.detail).not.toContain("given before");
  });

  it("counts it in the summary as new, not as a repeat", () => {
    expect(check.summary).toContain("1 new lesson(s)");
  });
});

describe("why lessons repeat: given before, never opened", () => {
  let check: Awaited<ReturnType<typeof whyLessonsRepeatCheck>>;

  beforeAll(async () => {
    await resetDb();
    const student = await makeStudent();
    const { subject, lesson } = await makeLesson("Long Division");
    await makePastAssignment(student.id, subject.id, lesson.id, YESTERDAY_KEY);
    await makeTodayAssignment(student.id, subject.id, lesson.id);
    // No LessonAttempt at all: it was put on the board before, but the child never opened it.

    check = await whyLessonsRepeatCheck();
  });

  it("is a warning, not a failure — this is unfinished work, not a bug", () => {
    expect(check.status).toBe("warn");
  });

  it("names the lesson as given before, with the date", () => {
    expect(check.detail).toContain("Long Division");
    expect(check.detail).toContain(`given before, last on ${YESTERDAY_KEY}`);
  });

  it("says it was never started", () => {
    expect(check.detail).toMatch(/never started/);
  });

  it("counts it as a never-opened repeat in the summary", () => {
    expect(check.summary).toContain("1 back because they were never opened");
  });
});

describe("why lessons repeat: started and abandoned part-way", () => {
  let check: Awaited<ReturnType<typeof whyLessonsRepeatCheck>>;

  beforeAll(async () => {
    await resetDb();
    const student = await makeStudent();
    const { subject, lesson } = await makeLesson("Percentages");
    await makePastAssignment(student.id, subject.id, lesson.id, YESTERDAY_KEY);
    const assignment = await makeTodayAssignment(student.id, subject.id, lesson.id);

    // Opened, got as far as PRACTICE, and stopped — no CHECK activity at all.
    await prisma.lessonAttempt.create({
      data: {
        studentId: student.id,
        lessonId: lesson.id,
        assignmentId: assignment.id,
        attemptNumber: 1,
        status: "IN_PROGRESS",
        currentStage: "PRACTICE",
      },
    });
    await prisma.studentLessonProgress.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "IN_PROGRESS" },
    });

    check = await whyLessonsRepeatCheck();
  });

  it("is a warning — unfinished work, not a fault", () => {
    expect(check.status).toBe("warn");
  });

  it("names the step it stopped at", () => {
    expect(check.detail).toContain("Percentages");
    expect(check.detail).toContain("stopped partway, at practice");
  });

  it("does not claim the quiz was ever answered", () => {
    expect(check.detail).not.toContain("quiz was answered");
  });

  it("counts it as an abandoned attempt in the summary", () => {
    expect(check.summary).toContain("1 back because they were left partway through");
  });
});

describe("why lessons repeat: the quiz was answered but never closed off", () => {
  let check: Awaited<ReturnType<typeof whyLessonsRepeatCheck>>;

  beforeAll(async () => {
    await resetDb();
    const student = await makeStudent();
    const { subject, lesson } = await makeLesson("Ratios");
    const assignment = await makeTodayAssignment(student.id, subject.id, lesson.id);

    const attempt = await prisma.lessonAttempt.create({
      data: {
        studentId: student.id,
        lessonId: lesson.id,
        assignmentId: assignment.id,
        attemptNumber: 1,
        status: "IN_PROGRESS",
        currentStage: "FEEDBACK",
        masteryScore: 0.9,
      },
    });
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "CHECK",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(),
        score: 4,
        maxScore: 4,
        percentage: 100,
      },
    });
    // The quiz being graded is exactly what `afterActivityGraded` reacts to in the real flow;
    // reproduced here directly so the progress row is in the same "not done yet" state.
    await prisma.studentLessonProgress.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "IN_PROGRESS" },
    });

    check = await whyLessonsRepeatCheck();
  });

  it("is a warning — this is the planner not having been told yet, not a fault", () => {
    expect(check.status).toBe("warn");
  });

  it("says the quiz was answered and marked", () => {
    expect(check.detail).toContain("Ratios");
    expect(check.detail).toContain("quiz was answered and marked");
    expect(check.detail).toContain("never closed off");
  });

  it("warns that Rebuild will not fix this by itself", () => {
    expect(check.detail).toMatch(/Rebuild will not fix this/);
  });

  it("counts it as an unclosed lesson in the summary", () => {
    expect(check.summary).toContain("1 back because the quiz was done but never closed off");
  });
});

describe("why lessons repeat: finished, and correctly counted as done", () => {
  let check: Awaited<ReturnType<typeof whyLessonsRepeatCheck>>;

  beforeAll(async () => {
    await resetDb();
    const student = await makeStudent();
    const { subject, lesson } = await makeLesson("Times Tables");
    await makePastAssignment(student.id, subject.id, lesson.id, YESTERDAY_KEY);
    // A parent chose to put it back on the board today, on purpose (a deliberate repeat).
    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId: student.id,
        date: TODAY,
        order: 0,
        kind: "LESSON",
        source: "PARENT",
        status: "PLANNED",
        subjectId: subject.id,
        lessonId: lesson.id,
        estimatedMinutes: 45,
      },
    });

    await prisma.lessonAttempt.create({
      data: {
        studentId: student.id,
        lessonId: lesson.id,
        assignmentId: assignment.id,
        attemptNumber: 1,
        status: "COMPLETED",
        currentStage: "COMPLETE",
        completedAt: new Date(),
        masteryScore: 0.95,
      },
    });
    await prisma.studentLessonProgress.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "COMPLETED", completedAt: new Date() },
    });

    check = await whyLessonsRepeatCheck();
  });

  it("is ok — a deliberate, correctly-recorded repeat is not a problem", () => {
    expect(check.status).toBe("ok");
  });

  it("says it is finished and a deliberate repeat", () => {
    expect(check.detail).toContain("Times Tables");
    expect(check.detail).toContain("Finished (completed) and correctly counted as done");
    expect(check.detail).toContain("deliberate repeat or review");
  });

  it("counts it as a deliberate repeat in the summary, not a fault", () => {
    expect(check.summary).toContain("1 deliberate repeat(s) of finished work");
  });
});

describe("why lessons repeat: finished, but the progress row disagrees (a real bug)", () => {
  let check: Awaited<ReturnType<typeof whyLessonsRepeatCheck>>;

  beforeAll(async () => {
    await resetDb();
    const student = await makeStudent();
    const { subject, lesson } = await makeLesson("Photosynthesis");
    const assignment = await makeTodayAssignment(student.id, subject.id, lesson.id);

    // The attempt is finished in every way that matters...
    await prisma.lessonAttempt.create({
      data: {
        studentId: student.id,
        lessonId: lesson.id,
        assignmentId: assignment.id,
        attemptNumber: 1,
        status: "COMPLETED",
        currentStage: "COMPLETE",
        completedAt: new Date(),
        masteryScore: 0.85,
      },
    });
    // ...but the row the planner actually reads was never brought into step — exactly the
    // fault `recomputeLessonProgress` exists to prevent, reproduced directly so the check is
    // proven against the disagreement itself rather than against how it might arise.
    await prisma.studentLessonProgress.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "NOT_STARTED" },
    });

    check = await whyLessonsRepeatCheck();
  });

  it("fails — this is a bug, not a fact about the child", () => {
    expect(check.status).toBe("fail");
  });

  it("names both sides of the disagreement", () => {
    expect(check.detail).toContain("Photosynthesis");
    expect(check.detail).toContain("The last attempt is finished (completed)");
    expect(check.detail).toContain('progress record says "not started"');
  });

  it("says plainly this is a bug, not the child's doing", () => {
    expect(check.detail).toMatch(/bug, not the child's doing/);
  });

  it("counts it as a bug in the summary", () => {
    expect(check.summary).toContain("1 that are a bug: finished but not recorded as done");
  });
});

describe("why lessons repeat: several children, several reasons, worst status wins", () => {
  let check: Awaited<ReturnType<typeof whyLessonsRepeatCheck>>;

  beforeAll(async () => {
    await resetDb();

    const eva = await makeStudent("Eva");
    const { subject: s1, lesson: l1 } = await makeLesson("Fresh Lesson");
    await makeTodayAssignment(eva.id, s1.id, l1.id);

    const sam = await makeStudent("Sam");
    const { subject: s2, lesson: l2 } = await makeLesson("Broken Lesson");
    const assignment = await makeTodayAssignment(sam.id, s2.id, l2.id);
    await prisma.lessonAttempt.create({
      data: {
        studentId: sam.id,
        lessonId: l2.id,
        assignmentId: assignment.id,
        attemptNumber: 1,
        status: "COMPLETED",
        currentStage: "COMPLETE",
        completedAt: new Date(),
      },
    });
    await prisma.studentLessonProgress.create({
      data: { studentId: sam.id, lessonId: l2.id, status: "IN_PROGRESS" },
    });

    check = await whyLessonsRepeatCheck();
  });

  it("fails overall — one real bug outweighs everything else being fine", () => {
    expect(check.status).toBe("fail");
  });

  it("still lists both children's boards", () => {
    expect(check.detail).toContain("Eva");
    expect(check.detail).toContain("Sam");
    expect(check.detail).toContain("Fresh Lesson");
    expect(check.detail).toContain("Broken Lesson");
  });
});
