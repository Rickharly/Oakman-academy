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
import { ApiError } from "@/lib/auth/api";
import { recomputeLessonProgress } from "@/lib/progress/aggregate";

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

  // Any assignment for it today is done — they have shown they do not need it.
  await prisma.dailyAssignment.updateMany({
    where: { studentId, lessonId, status: { in: ["PLANNED", "IN_PROGRESS"] } },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await recomputeLessonProgress(studentId, lessonId);
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
      message: "You already know this one. Moving you on to the next lesson.",
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
