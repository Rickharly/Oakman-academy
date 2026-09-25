import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { ensureDayPlanned, planWeek } from "@/lib/scheduling/planner";
import { requeueAbandonedReviews, settleAbandonedLessons, startOrResumeAttempt } from "@/lib/lessons/service";
import { recomputeLessonProgress } from "@/lib/progress/aggregate";
import { addDaysKey, schoolDayKey, toDateOnly, weekStartKey } from "@/lib/dates";

/**
 * The report: "kids are still getting lessons they already went through... some lessons are not
 * finally marked as done... I pressed rebuild today's lessons but still the same lessons."
 *
 * Two separate root causes, both traced to the same symptom — a `StudentLessonProgress` row that
 * never reaches a finished status, so `getIncompleteLessonSequence` (planner.ts) hands the same
 * lesson back:
 *
 *  1. Planning used to run *before* settling (`getTodayView` planned, then settled; the admin
 *     "rebuild today" and "re-plan" routes never settled at all). A lesson finished at the end of
 *     a session and never revisited was still IN_PROGRESS at the exact moment planning asked
 *     whether it was done.
 *  2. A lesson a child was genuinely taught and practised, then abandoned before ever reaching a
 *     graded CHECK, had no way to settle at all through `settleFinishedLessons`, which requires a
 *     graded CHECK to exist. This is deliberately narrow: a lesson abandoned *before* the
 *     teaching and practice are done is not settled at all — the planner keeps offering it, and
 *     `startOrResumeAttempt` resumes the same attempt at the same stage, which is correct (a
 *     child who stopped mid-lesson should pick the teaching back up, not be marked as having
 *     done it and sat a quiz on material nobody gave them).
 */

const MINUTES = 60 * 1000;
const HOURS = 60 * MINUTES;

/**
 * The Monday of the week after next, whatever day this test actually runs on.
 *
 * Always a weekday (so `ensureDayPlanned` never short-circuits on a weekend it deliberately
 * skips), and always the first day of the week the planner fills — with only one lesson left
 * candidate in a subject, `planWeek` places it on the week's first chosen day, so pinning the
 * assertion to Monday specifically (rather than "the next day", which could land mid-week) keeps
 * this test independent of what day it happens to run on.
 */
function nextPlanningMonday(): string {
  return weekStartKey(addDaysKey(schoolDayKey(), 7));
}

/**
 * Backdates an attempt's `updatedAt` well before today started.
 *
 * `updatedAt` is a Prisma `@updatedAt` column — the generated client refuses to accept it as an
 * ordinary field to write, because it is meant to be managed automatically. Raw SQL is the
 * legitimate way round that here: this is standing in for real elapsed time (the attempt was
 * last touched yesterday), not fighting the column's normal behaviour in the app itself.
 */
async function backdateUpdatedAt(attemptId: string, hoursAgo: number): Promise<void> {
  const when = new Date(Date.now() - hoursAgo * HOURS);
  await prisma.$executeRaw`UPDATE "LessonAttempt" SET "updatedAt" = ${when} WHERE id = ${attemptId}`;
}

/** Same idea as `backdateUpdatedAt`, for a `DailyAssignment` — also an `@updatedAt` column. */
async function backdateAssignmentUpdatedAt(assignmentId: string, hoursAgo: number): Promise<void> {
  const when = new Date(Date.now() - hoursAgo * HOURS);
  await prisma.$executeRaw`UPDATE "DailyAssignment" SET "updatedAt" = ${when} WHERE id = ${assignmentId}`;
}

async function buildStudentWithTwoLessons(lessonsPerDay = 1) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: `s${Math.random().toString(36).slice(2, 8)}`, passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3", lessonsPerDay },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: `maths${Math.random()}`, title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: `p${Math.random()}`, subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: `u${Math.random()}`, programmeId: programme.id, title: "Unit", order: 1 },
  });
  const lesson1 = await prisma.lesson.create({
    data: { provider: "test", providerSlug: `l1-${Math.random()}`, unitId: unit.id, title: "Fractions", order: 1 },
  });
  const lesson2 = await prisma.lesson.create({
    data: { provider: "test", providerSlug: `l2-${Math.random()}`, unitId: unit.id, title: "Decimals", order: 2 },
  });
  await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: programme.id } });
  await prisma.studentSchedule.create({ data: { studentId: student.id, subjectId: subject.id, weeklyFrequency: 5, priority: 1 } });
  return { studentId: student.id, lesson1, lesson2 };
}

describe("a lesson finished but never signed off must not be planned again", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("ensureDayPlanned (Today, 'rebuild today's lessons', pnpm plan) settles before it plans", async () => {
    const { studentId, lesson1, lesson2 } = await buildStudentWithTwoLessons();

    // Yesterday: the CHECK was answered and marked in full — then the child closed the laptop.
    // Nobody pressed Finish, and Today was never reopened, so nothing ever settled the attempt.
    const attempt = await prisma.lessonAttempt.create({
      data: {
        studentId,
        lessonId: lesson1.id,
        attemptNumber: 1,
        status: "IN_PROGRESS",
        currentStage: "FEEDBACK",
        masteryScore: 1,
        // A period's worth of time. Settling closes a period, and a period is only over when
        // its clock has run — a lesson still mid-period is left open on purpose, because
        // closing the tab must not end one.
        timeSpentSeconds: 46 * 60,
      },
    });
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "CHECK",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(Date.now() - 30 * MINUTES),
        score: 4,
        maxScore: 4,
        percentage: 100,
      },
    });
    // Exactly what `afterActivityGraded` leaves behind at the moment the quiz is marked: the
    // attempt itself is still IN_PROGRESS, and the progress row faithfully reports that.
    await recomputeLessonProgress(studentId, lesson1.id);
    const before = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId: lesson1.id } },
    });
    expect(before.status).toBe("IN_PROGRESS");

    const planningDay = nextPlanningMonday();
    await ensureDayPlanned(studentId, planningDay);

    const settledAttempt = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(settledAttempt.status).toBe("COMPLETED");

    const plannedLesson = await prisma.dailyAssignment.findFirst({
      where: { studentId, date: toDateOnly(planningDay), kind: "LESSON" },
    });
    // The next lesson in sequence, not the one already done.
    expect(plannedLesson?.lessonId).toBe(lesson2.id);
    expect(plannedLesson?.lessonId).not.toBe(lesson1.id);
  });

  it("planWeek settles too, since POST /api/admin/plan calls it directly and skips ensureDayPlanned", async () => {
    const { studentId, lesson1, lesson2 } = await buildStudentWithTwoLessons();

    const attempt = await prisma.lessonAttempt.create({
      data: {
        studentId,
        lessonId: lesson1.id,
        attemptNumber: 1,
        status: "IN_PROGRESS",
        currentStage: "FEEDBACK",
        masteryScore: 1,
        // A period's worth of time. Settling closes a period, and a period is only over when
        // its clock has run — a lesson still mid-period is left open on purpose, because
        // closing the tab must not end one.
        timeSpentSeconds: 46 * 60,
      },
    });
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "CHECK",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(Date.now() - 30 * MINUTES),
        score: 4,
        maxScore: 4,
        percentage: 100,
      },
    });
    await recomputeLessonProgress(studentId, lesson1.id);

    const planningDay = nextPlanningMonday();
    // A parent pressing "re-plan" in /admin/schedule — the route calls `planWeek` directly.
    await planWeek(studentId, planningDay, { replace: true });

    const settledAttempt = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(settledAttempt.status).toBe("COMPLETED");

    const plannedLesson = await prisma.dailyAssignment.findFirst({
      where: { studentId, date: toDateOnly(planningDay), kind: "LESSON" },
    });
    expect(plannedLesson?.lessonId).toBe(lesson2.id);
  });
});

describe("a lesson taught and practised in full, abandoned before the check", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("settles to NEEDS_REVIEW with one review item, instead of reappearing forever", async () => {
    const { studentId, lesson1, lesson2 } = await buildStudentWithTwoLessons();

    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId: lesson1.id, attemptNumber: 1, status: "IN_PROGRESS", currentStage: "CHECK" },
    });
    // Taught and practised in full — the video, the written lesson, and a marked PRACTICE round
    // all actually happened. Only the quiz itself was never sat.
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "STARTER",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(Date.now() - 5 * HOURS),
        score: 2,
        maxScore: 2,
        percentage: 100,
      },
    });
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "PRACTICE",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(Date.now() - 3 * HOURS),
        score: 3,
        maxScore: 4,
        percentage: 75,
      },
    });
    await recomputeLessonProgress(studentId, lesson1.id);
    // Last touched yesterday — this is what makes it abandoned rather than mid-session.
    await backdateUpdatedAt(attempt.id, 30);

    const planningDay = nextPlanningMonday();
    await ensureDayPlanned(studentId, planningDay);

    const settled = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(settled.status).toBe("NEEDS_REVIEW");
    expect(settled.completedAt).not.toBeNull();

    const progress = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId: lesson1.id } },
    });
    expect(progress.status).toBe("NEEDS_REVIEW");

    const reviewItems = await prisma.reviewItem.findMany({ where: { studentId, lessonId: lesson1.id } });
    expect(reviewItems).toHaveLength(1);
    // PENDING the instant it's created; the same `ensureDayPlanned` call immediately picks it up
    // and schedules it onto the board, since it's already due today — both are "queued, not lost".
    expect(["PENDING", "SCHEDULED"]).toContain(reviewItems[0].status);

    // Not reassigned as a fresh lesson: the maths period that day is the next one in sequence.
    const plannedLesson = await prisma.dailyAssignment.findFirst({
      where: { studentId, date: toDateOnly(planningDay), kind: "LESSON" },
    });
    expect(plannedLesson?.lessonId).toBe(lesson2.id);
  });

  it("does not queue a second review item if it is asked to settle the same lesson again", async () => {
    const { studentId, lesson1 } = await buildStudentWithTwoLessons();

    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId: lesson1.id, attemptNumber: 1, status: "IN_PROGRESS", currentStage: "CHECK" },
    });
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "PRACTICE",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(Date.now() - HOURS),
        score: 1,
        maxScore: 2,
        percentage: 50,
      },
    });

    await backdateUpdatedAt(attempt.id, 30);

    // Two different callers reaching the same student on the same stale attempt — a real
    // possibility since both `ensureDayPlanned` and `planWeek` call this.
    expect(await settleAbandonedLessons(studentId)).toBe(1);
    expect(await settleAbandonedLessons(studentId)).toBe(0); // already settled, nothing left stale

    const reviewItems = await prisma.reviewItem.findMany({ where: { studentId, lessonId: lesson1.id } });
    expect(reviewItems).toHaveLength(1);
  });

  it("leaves a lesson still open from earlier today alone", async () => {
    const { studentId, lesson1 } = await buildStudentWithTwoLessons();

    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId: lesson1.id, attemptNumber: 1, status: "IN_PROGRESS", currentStage: "CHECK" },
    });
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "PRACTICE",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(),
        score: 2,
        maxScore: 2,
        percentage: 100,
      },
    });

    // Qualifies on every other ground (taught, practised, sitting on CHECK) — but it was touched
    // moments ago, so settling against *today* must still leave it alone.
    expect(await settleAbandonedLessons(studentId)).toBe(0);

    const stillOpen = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(stillOpen.status).toBe("IN_PROGRESS");
  });
});

describe("a lesson abandoned before practice is left open, to be resumed", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("is not settled, is offered again by the planner, and resumes at the stage it stopped at", async () => {
    const { studentId, lesson1 } = await buildStudentWithTwoLessons();

    // They did the starter and stopped partway through the video or written lesson — never
    // reached practice, let alone the quiz. This is not a bug: they have not been taught the
    // lesson yet, so there is nothing honest to review, only teaching left to finish.
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId: lesson1.id, attemptNumber: 1, status: "IN_PROGRESS", currentStage: "LEARN" },
    });
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "STARTER",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(Date.now() - 30 * HOURS),
        score: 2,
        maxScore: 2,
        percentage: 100,
      },
    });
    await recomputeLessonProgress(studentId, lesson1.id);
    await backdateUpdatedAt(attempt.id, 30);

    expect(await settleAbandonedLessons(studentId)).toBe(0);
    const untouched = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(untouched.status).toBe("IN_PROGRESS");
    expect(untouched.currentStage).toBe("LEARN");

    // The planner still offers it — it is the next incomplete lesson in sequence, same as before.
    const planningDay = nextPlanningMonday();
    await ensureDayPlanned(studentId, planningDay);
    const plannedLesson = await prisma.dailyAssignment.findFirst({
      where: { studentId, date: toDateOnly(planningDay), kind: "LESSON" },
    });
    expect(plannedLesson?.lessonId).toBe(lesson1.id);

    // And opening it from that slot resumes the very same attempt, at the very same stage —
    // not a fresh start, and not a quiz on material they were never given.
    const resumed = await startOrResumeAttempt(studentId, lesson1.id, plannedLesson!.id);
    expect(resumed.id).toBe(attempt.id);
    expect(resumed.currentStage).toBe("LEARN");
  });

  it("leaves a lesson opened and abandoned with nothing answered alone — that is not evidence of anything", async () => {
    const { studentId, lesson1 } = await buildStudentWithTwoLessons();

    // Started (a `LessonAttempt` row exists) but nothing was ever saved or submitted — no
    // `ActivityAttempt` at all. This is indistinguishable from a lesson never opened, and is
    // left to behave like one rather than being promoted to a manufactured "needs review", even
    // though it is just as stale as the genuine cases above.
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId: lesson1.id, attemptNumber: 1, status: "IN_PROGRESS", currentStage: "STARTER" },
    });
    await backdateUpdatedAt(attempt.id, 30);

    expect(await settleAbandonedLessons(studentId)).toBe(0);
  });
});

describe("a review is never silently lost", () => {
  /**
   * A review's whole content is its CHECK — `runReviewAssignment` forces `currentStage` there
   * the moment it is opened, with no PRACTICE round ever existing for it. An earlier version of
   * `settleAbandonedLessons` matched on `currentStage` reaching CHECK alone, so a review opened
   * and never answered — zero `ActivityAttempt`s, nothing to show for it — was swept up, marked
   * NEEDS_REVIEW as though it had been taught and practised, and its `DailyAssignment` ticked
   * COMPLETED — while the linked `ReviewItem` stayed SCHEDULED forever, since only `completeReview`
   * ever moves it to DONE. The planner only ever plans a PENDING item, so a SCHEDULED item with no
   * live assignment anywhere is invisible and lost for good: the exact opposite of what a review
   * is for.
   */
  beforeEach(async () => {
    await resetDb();
  });

  it("settleAbandonedLessons never touches a review attempt, even one forced straight to CHECK", async () => {
    const { studentId, lesson1 } = await buildStudentWithTwoLessons();

    const reviewItem = await prisma.reviewItem.create({
      data: { studentId, lessonId: lesson1.id, reason: "LOW_SCORE", status: "SCHEDULED", dueAt: toDateOnly(schoolDayKey()) },
    });
    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(schoolDayKey()),
        order: 0,
        kind: "REVIEW",
        source: "REVIEW_ENGINE",
        status: "IN_PROGRESS", // opened
        reviewItemId: reviewItem.id,
        lessonId: lesson1.id,
        estimatedMinutes: 15,
      },
    });
    // Exactly what `runReviewAssignment` leaves behind: forced straight to CHECK, no PRACTICE
    // round, because a review never has one.
    const attempt = await prisma.lessonAttempt.create({
      data: {
        studentId,
        lessonId: lesson1.id,
        attemptNumber: 1,
        status: "IN_PROGRESS",
        currentStage: "CHECK",
        assignmentId: assignment.id,
      },
    });
    await backdateUpdatedAt(attempt.id, 30);
    await backdateAssignmentUpdatedAt(assignment.id, 30);

    expect(await settleAbandonedLessons(studentId)).toBe(0);
    const untouched = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(untouched.status).toBe("IN_PROGRESS");
    const untouchedAssignment = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(untouchedAssignment.status).toBe("IN_PROGRESS");
    expect(untouchedAssignment.completedAt).toBeNull();
  });

  it("a review opened and then abandoned requeues to PENDING instead, is not recorded as completed, and is offered again", async () => {
    const { studentId, lesson1 } = await buildStudentWithTwoLessons();

    const reviewItem = await prisma.reviewItem.create({
      data: { studentId, lessonId: lesson1.id, reason: "LOW_SCORE", status: "SCHEDULED", dueAt: toDateOnly(schoolDayKey()) },
    });
    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(schoolDayKey()),
        order: 0,
        kind: "REVIEW",
        source: "REVIEW_ENGINE",
        status: "IN_PROGRESS",
        reviewItemId: reviewItem.id,
        lessonId: lesson1.id,
        estimatedMinutes: 15,
      },
    });
    await backdateAssignmentUpdatedAt(assignment.id, 30);

    expect(await requeueAbandonedReviews(studentId)).toBe(1);

    const requeuedItem = await prisma.reviewItem.findUniqueOrThrow({ where: { id: reviewItem.id } });
    expect(requeuedItem.status).toBe("PENDING");

    // Not recorded as completed — the review was not done.
    const untouchedAssignment = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(untouchedAssignment.status).toBe("IN_PROGRESS");
    expect(untouchedAssignment.completedAt).toBeNull();

    // The next plan brings it back.
    const planningDay = nextPlanningMonday();
    await ensureDayPlanned(studentId, planningDay);
    const weekDates = [0, 1, 2, 3, 4].map((i) => toDateOnly(addDaysKey(planningDay, i)));
    const broughtBack = await prisma.dailyAssignment.findFirst({
      where: { studentId, date: { in: weekDates }, kind: "REVIEW", reviewItemId: reviewItem.id, status: { not: "MOVED" } },
    });
    expect(broughtBack).not.toBeNull();
  });

  it("does not requeue an item twice for the same stale assignment", async () => {
    const { studentId, lesson1 } = await buildStudentWithTwoLessons();

    const reviewItem = await prisma.reviewItem.create({
      data: { studentId, lessonId: lesson1.id, reason: "LOW_SCORE", status: "SCHEDULED", dueAt: toDateOnly(schoolDayKey()) },
    });
    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(schoolDayKey()),
        order: 0,
        kind: "REVIEW",
        source: "REVIEW_ENGINE",
        status: "IN_PROGRESS",
        reviewItemId: reviewItem.id,
        lessonId: lesson1.id,
        estimatedMinutes: 15,
      },
    });
    await backdateAssignmentUpdatedAt(assignment.id, 30);

    // Two different callers reaching the same stale review — the same real possibility as for
    // `settleAbandonedLessons`, since both `ensureDayPlanned` and `planWeek` call this.
    expect(await requeueAbandonedReviews(studentId)).toBe(1);
    expect(await requeueAbandonedReviews(studentId)).toBe(0);
  });

  it("a duplicate review removed by trimDayToTimetable is never left SCHEDULED with nothing to open it", async () => {
    const { studentId, lesson1 } = await buildStudentWithTwoLessons();
    const planningDay = nextPlanningMonday();
    const dayDate = toDateOnly(planningDay);

    // Two different review items both scheduling the same lesson on the same day — the
    // duplicate case `trimDayToTimetable` de-duplicates.
    const itemA = await prisma.reviewItem.create({
      data: { studentId, lessonId: lesson1.id, reason: "LOW_SCORE", status: "SCHEDULED", dueAt: dayDate },
    });
    const itemB = await prisma.reviewItem.create({
      data: { studentId, lessonId: lesson1.id, reason: "MISCONCEPTION", status: "SCHEDULED", dueAt: dayDate },
    });
    await prisma.dailyAssignment.create({
      data: { studentId, date: dayDate, order: 0, kind: "REVIEW", source: "REVIEW_ENGINE", status: "PLANNED", reviewItemId: itemA.id, lessonId: lesson1.id, estimatedMinutes: 15 },
    });
    await prisma.dailyAssignment.create({
      data: { studentId, date: dayDate, order: 1, kind: "REVIEW", source: "REVIEW_ENGINE", status: "PLANNED", reviewItemId: itemB.id, lessonId: lesson1.id, estimatedMinutes: 15 },
    });

    await ensureDayPlanned(studentId, planningDay);

    const reviewsOnDay = await prisma.dailyAssignment.count({
      where: { studentId, date: dayDate, kind: "REVIEW", status: { not: "MOVED" } },
    });
    expect(reviewsOnDay).toBe(1); // de-duplicated down to one

    // Whichever item lost its slot must be either re-placed (still SCHEDULED, with a live
    // assignment somewhere) or handed back to PENDING — never SCHEDULED with nothing left
    // anywhere that will ever plan it again.
    for (const itemId of [itemA.id, itemB.id]) {
      const item = await prisma.reviewItem.findUniqueOrThrow({ where: { id: itemId } });
      if (item.status === "SCHEDULED") {
        const liveAssignments = await prisma.dailyAssignment.count({ where: { reviewItemId: itemId } });
        expect(liveAssignments).toBeGreaterThan(0);
      } else {
        expect(item.status).toBe("PENDING");
      }
    }
  });

  it("a surplus review (over the daily cap) removed by trimDayToTimetable is never left stranded either", async () => {
    const { studentId, lesson1, lesson2 } = await buildStudentWithTwoLessons();
    const planningDay = nextPlanningMonday();
    const dayDate = toDateOnly(planningDay);

    // Two reviews for two *different* lessons on the same day — not duplicates of each other,
    // but still over `MAX_REVIEWS_PER_DAY` (1), so the surplus-cap branch removes one.
    const itemA = await prisma.reviewItem.create({
      data: { studentId, lessonId: lesson1.id, reason: "LOW_SCORE", status: "SCHEDULED", dueAt: dayDate },
    });
    const itemB = await prisma.reviewItem.create({
      data: { studentId, lessonId: lesson2.id, reason: "LOW_SCORE", status: "SCHEDULED", dueAt: dayDate },
    });
    await prisma.dailyAssignment.create({
      data: { studentId, date: dayDate, order: 0, kind: "REVIEW", source: "REVIEW_ENGINE", status: "PLANNED", reviewItemId: itemA.id, lessonId: lesson1.id, estimatedMinutes: 15 },
    });
    await prisma.dailyAssignment.create({
      data: { studentId, date: dayDate, order: 1, kind: "REVIEW", source: "REVIEW_ENGINE", status: "PLANNED", reviewItemId: itemB.id, lessonId: lesson2.id, estimatedMinutes: 15 },
    });

    await ensureDayPlanned(studentId, planningDay);

    const reviewsOnDay = await prisma.dailyAssignment.count({
      where: { studentId, date: dayDate, kind: "REVIEW", status: { not: "MOVED" } },
    });
    expect(reviewsOnDay).toBe(1); // capped down to one

    for (const itemId of [itemA.id, itemB.id]) {
      const item = await prisma.reviewItem.findUniqueOrThrow({ where: { id: itemId } });
      if (item.status === "SCHEDULED") {
        const liveAssignments = await prisma.dailyAssignment.count({ where: { reviewItemId: itemId } });
        expect(liveAssignments).toBeGreaterThan(0);
      } else {
        expect(item.status).toBe("PENDING");
      }
    }
  });
});
