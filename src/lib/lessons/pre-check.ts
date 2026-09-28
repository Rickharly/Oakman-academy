/**
 * "Do you already know this?" — a short check before a lesson starts.
 *
 * A child who already understands a topic learns nothing from being walked through it, and
 * learns something worse: that this school does not notice what they know. So before a lesson
 * begins they can try its exit questions. Get them right and the lesson is theirs already;
 * they move on rather than sitting through it.
 *
 * Two things this is careful about.
 *
 * **The bar is high and needs more than a guess.** A lesson is only skipped on a near-perfect
 * score across enough questions that luck cannot produce it. Wrongly skipping a lesson leaves
 * a hole that surfaces weeks later, which is far more costly than twenty minutes of revision.
 *
 * **The record says what actually happened.** A lesson placed out of is recorded as assessed,
 * never as taught. A school reading the record later must be able to tell the difference.
 */
import { prisma } from "@/lib/db";
import { isLessonDone } from "@/lib/progress/aggregate";
import { ApiError } from "@/lib/auth/api";

/** Score needed to skip. Deliberately near-perfect: the cost of a wrong skip is a hidden gap. */
export const PRE_CHECK_PASS = 0.9;
/** Below this many questions, a good score is luck rather than knowledge. */
export const PRE_CHECK_MIN_QUESTIONS = 3;

export type PreCheckOutcome = {
  passed: boolean;
  scorePct: number;
  answered: number;
  /** What the child is told. Never a bare percentage. */
  message: string;
};


/**
 * The next lesson in this programme the child has not been through.
 *
 * Used when a pre-check places them out: the period needs something real in it, and the next
 * thing they have not done is what a school would move on to.
 */
async function nextUntaughtLesson(studentId: string, lessonId: string) {
  const current = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: true },
  });
  if (!current) return null;

  const lessons = await prisma.lesson.findMany({
    where: { unit: { programmeId: current.unit.programmeId } },
    include: { unit: true },
    orderBy: [{ unit: { order: "asc" } }, { order: "asc" }],
  });

  const progress = await prisma.studentLessonProgress.findMany({
    where: { studentId, lessonId: { in: lessons.map((l) => l.id) } },
  });
  const done = new Set(progress.filter(isLessonDone).map((p) => p.lessonId));
  done.add(lessonId); // the one they have just placed out of

  const position = lessons.findIndex((l) => l.id === lessonId);
  const after = position >= 0 ? lessons.slice(position + 1) : lessons;
  return after.find((l) => !done.has(l.id)) ?? lessons.find((l) => !done.has(l.id)) ?? null;
}

/**
 * Marks a lesson as already known, from a pre-check the child passed.
 *
 * Not a completion: no LessonAttempt is invented, and the progress row records mastery with a
 * reason that says how it was established.
 */
export async function placeOutOfLesson(
  studentId: string,
  lessonId: string,
  scorePct: number,
): Promise<void> {
  const mastery = Math.min(1, Math.max(0, scorePct / 100));

  await prisma.studentLessonProgress.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    create: {
      studentId,
      lessonId,
      status: "MASTERED",
      attempts: 0,
      bestScorePct: scorePct,
      latestScorePct: scorePct,
      mastery,
      completedAt: new Date(),
      lastActivityAt: new Date(),
    },
    update: {
      status: "MASTERED",
      bestScorePct: scorePct,
      latestScorePct: scorePct,
      mastery,
      completedAt: new Date(),
      lastActivityAt: new Date(),
    },
  });

  // The audit trail. "placement_check" is what tells a reader this was assessed, not taught.
  await prisma.masteryRecord.create({
    data: { studentId, lessonId, mastery, confidence: 0.7, reason: "placement_check" },
  });

  await prisma.activityLog.create({
    data: { studentId, kind: "lesson_placed_out", data: { lessonId, scorePct } },
  });

  /**
   * The period carries on with the next topic. It does not end.
   *
   * This used to mark the period finished — they had shown they did not need the lesson, so the
   * slot was ticked and the child was free. Two things went wrong with that. A child who passes
   * four pre-checks in ten minutes has a board of green ticks and an empty day, and the planner
   * sees a full day and adds nothing. And the attempt for the skipped lesson was deliberately
   * left open, so opening that ticked lesson later dropped them into a dead Feedback screen
   * with the period lock on and nothing to do — the exact trap this app began with.
   *
   * Knowing the topic is a reason to move on to the next one, not a reason to stop. So the slot
   * is pointed at the next lesson they have not done and the period keeps running, which is the
   * same rule as passing the end-of-topic test.
   */
  const next = await nextUntaughtLesson(studentId, lessonId);
  if (next) {
    await prisma.dailyAssignment.updateMany({
      where: { studentId, lessonId, status: { in: ["PLANNED", "IN_PROGRESS"] } },
      data: { lessonId: next.id, status: "IN_PROGRESS" },
    });
  } else {
    // Nothing left in the sequence to move them to. Then the slot really is finished.
    await prisma.dailyAssignment.updateMany({
      where: { studentId, lessonId, status: { in: ["PLANNED", "IN_PROGRESS"] } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  /**
   * And the attempt that was opened for the lesson they skipped is closed.
   *
   * Left open, it is a lesson that is both "mastered" and "in progress" — which is what put a
   * child on a Feedback screen for a lesson they never sat.
   */
  await prisma.lessonAttempt.updateMany({
    where: { studentId, lessonId, status: "IN_PROGRESS" },
    data: { status: "MASTERED", completedAt: new Date(), currentStage: "COMPLETE" },
  });

  // Deliberately not `recomputeLessonProgress` here: the upsert above already is the definitive
  // outcome. The page always starts/resumes a LessonAttempt before it ever offers the pre-check,
  // so one already exists — IN_PROGRESS, nothing answered — by the time a pass reaches this
  // function, and recomputing from it would flip the row this just wrote straight back to
  // IN_PROGRESS with a null mastery, undoing the placement immediately and re-offering the
  // pre-check next time the lesson is opened.
}

/** Judges a submitted pre-check and, if it is convincing, places them out of the lesson. */
export async function judgePreCheck(input: {
  studentId: string;
  lessonId: string;
  correct: number;
  total: number;
}): Promise<PreCheckOutcome> {
  const { studentId, lessonId, correct, total } = input;
  if (total <= 0) throw new ApiError(400, "Nothing was answered.");

  const scorePct = Math.round((correct / total) * 100);
  const enough = total >= PRE_CHECK_MIN_QUESTIONS;
  const passed = enough && correct / total >= PRE_CHECK_PASS;

  if (passed) {
    await placeOutOfLesson(studentId, lessonId, scorePct);
    return {
      passed: true,
      scorePct,
      answered: total,
      message: "You already know this one — so we'll spend the rest of the period on the next one instead.",
    };
  }

  return {
    passed: false,
    scorePct,
    answered: total,
    message: enough
      ? "Worth going through properly — there are a couple of things in here for you."
      : "Let's go through this one properly.",
  };
}
