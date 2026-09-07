/**
 * Review engine (spec §24–§27; ARCHITECTURE §8). `afterActivityGraded` is the
 * single hook called by `submitStage` after every graded `ActivityAttempt`:
 * it recomputes `StudentLessonProgress`, appends `MasteryRecord`s, and raises
 * `ReviewItem`s for low scores, misconceptions and repeated mistakes.
 */
import { prisma } from "@/lib/db";
import type { LessonAttempt, ReviewItem } from "@/generated/prisma/client";
import { addDaysKey, dateOnlyKey, toDateOnly, todayDateOnly } from "@/lib/dates";
import { ApiError } from "@/lib/auth/api";
import { teacherAgent } from "@/lib/ai/teacher-agent";
import { recomputeLessonProgress } from "./aggregate";

const STEP_DAYS = [1, 7, 30] as const;

function tomorrow(): Date {
  return toDateOnly(addDaysKey(dateOnlyKey(todayDateOnly()), 1));
}

async function reviewItemPending(studentId: string, lessonId: string, reason: "LOW_SCORE" | "MISCONCEPTION" | "REPEATED_MISTAKE", detail?: string) {
  return prisma.reviewItem.findFirst({
    where: {
      studentId,
      lessonId,
      reason,
      status: { in: ["PENDING", "SCHEDULED"] },
      ...(detail !== undefined ? { detail } : {}),
    },
  });
}

export async function afterActivityGraded(activityAttemptId: string): Promise<void> {
  const activity = await prisma.activityAttempt.findUnique({
    where: { id: activityAttemptId },
    include: { lessonAttempt: true, questionAttempts: true },
  });
  if (!activity) return;

  const { lessonAttempt } = activity;
  const studentId = lessonAttempt.studentId;
  const lessonId = lessonAttempt.lessonId;

  const previousProgress = await prisma.studentLessonProgress.findUnique({
    where: { studentId_lessonId: { studentId, lessonId } },
  });
  const previousMastery = previousProgress?.mastery ?? null;

  const progress = await recomputeLessonProgress(studentId, lessonId);

  if (activity.stage === "CHECK" && progress.mastery != null && progress.mastery !== previousMastery) {
    await prisma.masteryRecord.create({
      data: {
        studentId,
        lessonId,
        mastery: progress.mastery,
        previousMastery,
        confidence: 0.7,
        reason: "check_quiz",
        sourceId: activity.id,
      },
    });
  }

  if (activity.stage === "CHECK") {
    const pct = activity.maxScore && activity.maxScore > 0 ? ((activity.score ?? 0) / activity.maxScore) * 100 : 100;
    if (pct < 70) {
      const existing = await reviewItemPending(studentId, lessonId, "LOW_SCORE");
      if (!existing) {
        await prisma.reviewItem.create({
          data: {
            studentId,
            lessonId,
            reason: "LOW_SCORE",
            status: "PENDING",
            dueAt: tomorrow(),
            detail: `Scored ${Math.round(pct)}% on the check quiz.`,
          },
        });
      }
    }
  }

  // Misconceptions raised on any graded question this activity.
  const seenThisActivity = new Set<string>();
  for (const qa of activity.questionAttempts) {
    const misconceptions = (qa.misconceptions as string[] | null) ?? [];
    for (const text of misconceptions) {
      if (!text || seenThisActivity.has(`${qa.questionId}:${text}`)) continue;
      seenThisActivity.add(`${qa.questionId}:${text}`);

      const existing = await reviewItemPending(studentId, lessonId, "MISCONCEPTION", text);
      if (!existing) {
        await prisma.reviewItem.create({
          data: {
            studentId,
            lessonId,
            questionId: qa.questionId,
            reason: "MISCONCEPTION",
            status: "PENDING",
            dueAt: tomorrow(),
            detail: text,
          },
        });
      }

      const historical = await prisma.questionAttempt.findMany({
        where: { studentId, gradedBy: { not: "PENDING" } },
        select: { misconceptions: true },
      });
      const occurrences = historical.filter(
        (h) => Array.isArray(h.misconceptions) && (h.misconceptions as unknown[]).includes(text)
      ).length;
      if (occurrences >= 2) {
        const existingRepeat = await prisma.reviewItem.findFirst({
          where: { studentId, reason: "REPEATED_MISTAKE", detail: text, status: { in: ["PENDING", "SCHEDULED"] } },
        });
        if (!existingRepeat) {
          await prisma.reviewItem.create({
            data: {
              studentId,
              lessonId,
              questionId: qa.questionId,
              reason: "REPEATED_MISTAKE",
              status: "PENDING",
              dueAt: tomorrow(),
              detail: text,
            },
          });
        }
      }
    }
  }

  const hasAiGraded = activity.questionAttempts.some((qa) => qa.gradedBy === "AI");
  if (hasAiGraded) {
    try {
      const graded = await prisma.questionAttempt.findMany({
        where: { activityAttemptId: activity.id, gradedBy: { not: "PENDING" } },
      });
      await teacherAgent.identifyMisconceptions({ studentId, lessonId, attempts: graded });
    } catch (err) {
      console.error("identifyMisconceptions failed", err);
    }
  }
}

export async function getReviewQueue(studentId: string, dateKey: string): Promise<ReviewItem[]> {
  return prisma.reviewItem.findMany({
    where: {
      studentId,
      status: { in: ["PENDING", "SCHEDULED"] },
      dueAt: { lte: toDateOnly(dateKey) },
    },
    orderBy: { dueAt: "asc" },
  });
}

export async function completeReview(reviewItemId: string, scorePct: number): Promise<ReviewItem> {
  const item = await prisma.reviewItem.findUnique({ where: { id: reviewItemId } });
  if (!item) throw new ApiError(404, "Review item not found");

  const updated = await prisma.reviewItem.update({
    where: { id: reviewItemId },
    data: { status: "DONE", outcomeScorePct: scorePct, completedAt: new Date() },
  });

  const todayKey = dateOnlyKey(todayDateOnly());

  if (scorePct >= 80) {
    if (item.intervalStep < 2) {
      const nextStepIdx = item.intervalStep + 1;
      const days = STEP_DAYS[nextStepIdx];
      await prisma.reviewItem.create({
        data: {
          studentId: item.studentId,
          lessonId: item.lessonId,
          unitId: item.unitId,
          questionId: item.questionId,
          reason: "SPACED",
          status: "PENDING",
          intervalStep: nextStepIdx,
          dueAt: toDateOnly(addDaysKey(todayKey, days)),
          detail: item.detail,
        },
      });
    }
  } else {
    await prisma.reviewItem.create({
      data: {
        studentId: item.studentId,
        lessonId: item.lessonId,
        unitId: item.unitId,
        questionId: item.questionId,
        reason: "SPACED",
        status: "PENDING",
        intervalStep: 0,
        dueAt: toDateOnly(addDaysKey(todayKey, 1)),
        detail: item.detail,
      },
    });
  }

  return updated;
}

/**
 * Starts (or resumes) the attempt for a review assignment's lesson, jumps
 * straight to CHECK (the stage a review re-runs), and stamps the earlier
 * stages as skipped so the lesson view shows them done.
 */
export async function runReviewAssignment(assignmentId: string, studentId: string): Promise<LessonAttempt> {
  const assignment = await prisma.dailyAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new ApiError(404, "Assignment not found");
  if (assignment.studentId !== studentId) throw new ApiError(403, "Not your assignment");
  if (!assignment.lessonId) throw new ApiError(400, "Review assignment has no lesson");

  // Deferred import avoids a circular dependency at module-load time
  // (lessons/service.ts calls back into this module for completeReview).
  const { startOrResumeAttempt } = await import("@/lib/lessons/service");
  const attempt = await startOrResumeAttempt(studentId, assignment.lessonId, assignment.id);

  const now = new Date();
  return prisma.lessonAttempt.update({
    where: { id: attempt.id },
    data: {
      currentStage: "CHECK",
      starterCompletedAt: attempt.starterCompletedAt ?? now,
      instructionCompletedAt: attempt.instructionCompletedAt ?? now,
      practiceCompletedAt: attempt.practiceCompletedAt ?? now,
    },
  });
}
