/**
 * Lesson flow service (spec §10; ARCHITECTURE §4). Owns `LessonAttempt` /
 * `ActivityAttempt` / `QuestionAttempt` state transitions. See docs/CONTRACTS.md
 * for the exact exported signatures.
 */
import { prisma } from "@/lib/db";
import { recordAttemptPunctuality } from "@/lib/engagement/service";
import { Prisma } from "@/generated/prisma/client";
import type {
  ActivityAttempt,
  Lesson,
  LessonAttempt,
  LessonResource,
  LessonStage,
  Programme,
  Question,
  QuestionAttempt,
  Subject,
  TeacherMode,
  Unit,
} from "@/generated/prisma/client";
import { ApiError } from "@/lib/auth/api";
import { gradeQuestion, type GradingContext } from "@/lib/grading/grade";
import { teacherAgent, teacherModeForStage } from "@/lib/ai/teacher-agent";
import { recomputeLessonProgress } from "@/lib/progress/aggregate";
import { hideUnanswerableQuestions } from "@/lib/questions/unanswerable";
import { parkOpenGaps } from "@/lib/lessons/understanding";
import { afterActivityGraded } from "@/lib/progress/review";
import { completeReview } from "@/lib/progress/review";
import {
  STAGES,
  gradedStages,
  isGradedStage,
  nextStage,
  stageIndex,
  stageTimestampField,
  type GradedStage,
} from "./stages";

export type StudentQuestion = Omit<Question, "answerKey" | "rubric">;

export interface AttemptView {
  attempt: LessonAttempt;
  lesson: Lesson & { unit: Unit & { programme: Programme & { subject: Subject } }; resources: LessonResource[] };
  stages: { stage: LessonStage; status: "locked" | "current" | "done"; completedAt: Date | null }[];
  questionsByStage: Record<"STARTER" | "PRACTICE" | "CHECK", StudentQuestion[]>;
  activities: (ActivityAttempt & { questionAttempts: QuestionAttempt[] })[];
  drafts: Record<string, unknown>;
  worksheetFallback: LessonResource | null;
  teacherMode: TeacherMode;
}

const STAGE_DIRECT_LOOKUP = new Set<LessonStage>(["STARTER", "PRACTICE", "CHECK"]);

// ───────────────────────────── helpers ─────────────────────────────

async function loadOwnedAttempt(attemptId: string, studentId: string): Promise<LessonAttempt> {
  const attempt = await prisma.lessonAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new ApiError(404, "Lesson attempt not found");
  if (attempt.studentId !== studentId) throw new ApiError(403, "Not your lesson attempt");
  return attempt;
}

/** Questions visible to a student: not excluded, and AI-generated only when generated for them. */
function visibleQuestionsWhere(studentId: string) {
  return {
    excluded: false,
    OR: [{ source: { not: "AI_GENERATED" as const } }, { generatedForStudentId: studentId }],
  };
}

async function getVisibleQuestions(lessonId: string, studentId: string, stage?: LessonStage): Promise<Question[]> {
  return prisma.question.findMany({
    where: {
      lessonId,
      stage: stage ? stage : { in: ["STARTER", "PRACTICE", "CHECK"] },
      ...visibleQuestionsWhere(studentId),
    },
    orderBy: { order: "asc" },
  });
}

/**
 * Latest ActivityAttempt for a stage, for drafting: reuses it unless the last
 * one is already GRADED, in which case a fresh round is opened (attemptNumber
 * + 1). `retryQuestion` is the normal way to reopen a GRADED activity for one
 * question; this covers the same "start a new round" contract literally.
 */
async function getOrOpenActivity(lessonAttemptId: string, stage: GradedStage): Promise<ActivityAttempt> {
  const latest = await prisma.activityAttempt.findFirst({
    where: { lessonAttemptId, stage },
    orderBy: { attemptNumber: "desc" },
  });
  if (latest && latest.status !== "GRADED") return latest;
  return prisma.activityAttempt.create({
    data: { lessonAttemptId, stage, attemptNumber: (latest?.attemptNumber ?? 0) + 1, status: "IN_PROGRESS" },
  });
}

/**
 * Latest ActivityAttempt for `submitStage`: always reuses it (creating one
 * only when none exists yet at all). Unlike `getOrOpenActivity`, resubmitting
 * an already-GRADED stage with nothing new to grade must be a no-op, not spawn
 * a fresh empty round — that would treat every question as "missing" and
 * silently zero out an already-graded stage.
 */
async function getActivityForSubmit(lessonAttemptId: string, stage: GradedStage): Promise<ActivityAttempt> {
  const latest = await prisma.activityAttempt.findFirst({
    where: { lessonAttemptId, stage },
    orderBy: { attemptNumber: "desc" },
  });
  if (latest) return latest;
  return prisma.activityAttempt.create({ data: { lessonAttemptId, stage, attemptNumber: 1, status: "IN_PROGRESS" } });
}

/** Number of already-graded (non-PENDING) attempts recorded for a question within one activity. */
export async function countGradedAttempts(activityAttemptId: string, questionId: string): Promise<number> {
  return prisma.questionAttempt.count({
    where: { activityAttemptId, questionId, gradedBy: { not: "PENDING" } },
  });
}

async function finalizeStageAdvance(attempt: LessonAttempt, stage: GradedStage, isCurrent: boolean): Promise<void> {
  const field = stageTimestampField(stage);
  const data: Record<string, unknown> = {};
  if (field && !attempt[field]) data[field] = new Date();
  if (isCurrent) {
    const next = nextStage(stage);
    if (next) data.currentStage = next;
  }
  if (Object.keys(data).length > 0) {
    await prisma.lessonAttempt.update({ where: { id: attempt.id }, data });
  }
}

/** Blends CHECK % with PRACTICE % (0.8 / 0.2) per ARCHITECTURE §4 and stamps score/masteryScore. */
async function recomputeMasteryScore(lessonAttemptId: string): Promise<void> {
  const checkActivity = await prisma.activityAttempt.findFirst({
    where: { lessonAttemptId, stage: "CHECK", status: "GRADED" },
    orderBy: { attemptNumber: "desc" },
  });
  if (!checkActivity) return;
  const practiceActivity = await prisma.activityAttempt.findFirst({
    where: { lessonAttemptId, stage: "PRACTICE", status: "GRADED" },
    orderBy: { attemptNumber: "desc" },
  });

  const checkPct = checkActivity.maxScore && checkActivity.maxScore > 0 ? (checkActivity.score ?? 0) / checkActivity.maxScore : 0;
  let masteryScore = checkPct;
  if (practiceActivity && practiceActivity.maxScore && practiceActivity.maxScore > 0) {
    const practicePct = (practiceActivity.score ?? 0) / practiceActivity.maxScore;
    masteryScore = 0.8 * checkPct + 0.2 * practicePct;
  }

  await prisma.lessonAttempt.update({
    where: { id: lessonAttemptId },
    data: { score: checkActivity.score, maxScore: checkActivity.maxScore, masteryScore },
  });
}

// ───────────────────────────── contract exports ─────────────────────────────

export async function startOrResumeAttempt(
  studentId: string,
  lessonId: string,
  assignmentId?: string
): Promise<LessonAttempt> {
  // Before anything else: take out the questions that ask about a picture this lesson does not
  // have. A child cannot tell those apart from a question they should know — they guess, get it
  // wrong, and the app marks them down and offers to re-teach something they may understand
  // perfectly well. Never fatal; a lesson opens either way.
  await hideUnanswerableQuestions(lessonId).catch(() => undefined);

  const existing = await prisma.lessonAttempt.findFirst({
    where: { studentId, lessonId, status: "IN_PROGRESS" },
    orderBy: { attemptNumber: "desc" },
  });
  if (existing) return existing;

  const priorCount = await prisma.lessonAttempt.count({ where: { studentId, lessonId } });

  const attempt = await prisma.lessonAttempt.create({
    data: {
      studentId,
      lessonId,
      assignmentId: assignmentId ?? null,
      attemptNumber: priorCount + 1,
      status: "IN_PROGRESS",
      currentStage: "STARTER",
    },
  });

  if (assignmentId) {
    await prisma.dailyAssignment.updateMany({
      where: { id: assignmentId, status: "PLANNED" },
      data: { status: "IN_PROGRESS" },
    });
  }

  await recomputeLessonProgress(studentId, lessonId);

  await prisma.activityLog.create({
    data: { studentId, kind: "lesson_started", data: { lessonId, attemptId: attempt.id, attemptNumber: attempt.attemptNumber } },
  });

  // Anchors the school day on the first lesson and records how punctually this period began.
  // Never fatal: a child must be able to start a lesson even if the bookkeeping fails.
  await recordAttemptPunctuality(attempt).catch(() => undefined);

  return attempt;
}

export async function getAttemptView(attemptId: string, studentId: string): Promise<AttemptView> {
  const attempt = await prisma.lessonAttempt.findUnique({
    where: { id: attemptId },
    include: {
      lesson: { include: { unit: { include: { programme: { include: { subject: true } } } }, resources: true } },
    },
  });
  if (!attempt) throw new ApiError(404, "Lesson attempt not found");
  if (attempt.studentId !== studentId) throw new ApiError(403, "Not your lesson attempt");

  const { lesson, ...attemptFields } = attempt;

  const questions = await getVisibleQuestions(lesson.id, studentId);
  const questionsByStage: Record<"STARTER" | "PRACTICE" | "CHECK", StudentQuestion[]> = {
    STARTER: [],
    PRACTICE: [],
    CHECK: [],
  };
  for (const q of questions) {
    if (!STAGE_DIRECT_LOOKUP.has(q.stage)) continue;
    const { answerKey: _answerKey, rubric: _rubric, ...rest } = q;
    void _answerKey;
    void _rubric;
    questionsByStage[q.stage as "STARTER" | "PRACTICE" | "CHECK"].push(rest);
  }

  const activities = await prisma.activityAttempt.findMany({
    where: { lessonAttemptId: attempt.id },
    include: { questionAttempts: true },
    orderBy: { startedAt: "asc" },
  });

  const drafts: Record<string, unknown> = {};
  const draftAttemptNumber: Record<string, number> = {};
  for (const activity of activities) {
    for (const qa of activity.questionAttempts) {
      if (qa.gradedBy !== "PENDING") continue;
      const seen = draftAttemptNumber[qa.questionId];
      if (seen === undefined || qa.attemptNumber > seen) {
        draftAttemptNumber[qa.questionId] = qa.attemptNumber;
        drafts[qa.questionId] = qa.response;
      }
    }
  }

  const currentIdx = stageIndex(attempt.currentStage);
  const stages = STAGES.map((stage) => {
    const idx = stageIndex(stage);
    const field = stageTimestampField(stage);
    const completedAt: Date | null = field ? ((attempt as unknown as Record<string, Date | null>)[field] ?? null) : null;
    let done = completedAt != null;
    if (!field && stage === "FEEDBACK") {
      done = currentIdx > idx;
    }
    const status: "locked" | "current" | "done" = done ? "done" : stage === attempt.currentStage ? "current" : "locked";
    return { stage, status, completedAt };
  });

  const worksheetFallback = lesson.resources.find((r) => r.type === "WORKSHEET") ?? null;

  return {
    attempt: attemptFields as LessonAttempt,
    lesson,
    stages,
    questionsByStage,
    activities,
    drafts,
    worksheetFallback,
    teacherMode: teacherModeForStage(attempt.currentStage),
  };
}

export async function saveDraftAnswer(
  attemptId: string,
  studentId: string,
  questionId: string,
  response: unknown
): Promise<void> {
  const attempt = await loadOwnedAttempt(attemptId, studentId);
  if (attempt.status !== "IN_PROGRESS") throw new ApiError(400, "Lesson attempt is not in progress");

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question || question.lessonId !== attempt.lessonId) throw new ApiError(404, "Question not found");
  const stage = question.stage;
  if (!isGradedStage(stage)) throw new ApiError(400, `Cannot save answers for a ${stage} question`);

  // A stage is draftable while it's current, or while it's already done (revisiting
  // to answer a retried question) — the same rule submitStage uses.
  const field = stageTimestampField(stage)!;
  const alreadyDone = (attempt as unknown as Record<string, Date | null>)[field] != null;
  if (attempt.currentStage !== stage && !alreadyDone) throw new ApiError(400, "Stage is not available yet");

  const activity = await getOrOpenActivity(attempt.id, stage);

  const latest = await prisma.questionAttempt.findFirst({
    where: { activityAttemptId: activity.id, questionId },
    orderBy: { attemptNumber: "desc" },
  });

  if (latest && latest.gradedBy === "PENDING") {
    await prisma.questionAttempt.update({
      where: { id: latest.id },
      data: { response: response as Prisma.InputJsonValue, submittedAt: new Date() },
    });
  } else {
    await prisma.questionAttempt.create({
      data: {
        activityAttemptId: activity.id,
        questionId,
        studentId,
        attemptNumber: (latest?.attemptNumber ?? 0) + 1,
        response: response as Prisma.InputJsonValue,
        maxScore: question.maxScore,
        gradedBy: "PENDING",
      },
    });
  }
}

export async function submitStage(
  attemptId: string,
  studentId: string,
  stage: GradedStage
): Promise<{ activity: ActivityAttempt; results: (QuestionAttempt & { question: Question })[] }> {
  const attempt = await loadOwnedAttempt(attemptId, studentId);
  if (attempt.status !== "IN_PROGRESS") throw new ApiError(400, "Lesson attempt is not in progress");

  const field = stageTimestampField(stage)!;
  const alreadyDone = (attempt as unknown as Record<string, Date | null>)[field] != null;
  const isCurrent = attempt.currentStage === stage;
  if (!isCurrent && !alreadyDone) throw new ApiError(400, "Stage is not available yet");

  const questions = await getVisibleQuestions(attempt.lessonId, studentId, stage);

  if (questions.length === 0) {
    const activity = await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage,
        attemptNumber: 1,
        status: "GRADED",
        submittedAt: new Date(),
        gradedAt: new Date(),
        score: 0,
        maxScore: 0,
        percentage: null,
      },
    });
    await finalizeStageAdvance(attempt, stage, isCurrent);
    return { activity, results: [] };
  }

  const activity = await getActivityForSubmit(attempt.id, stage);

  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: attempt.lessonId } });
  const student = await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId } });
  const ctx: GradingContext = {
    studentYearGroup: student.yearGroup,
    lesson: {
      title: lesson.title,
      keyLearningPoints: (lesson.keyLearningPoints as string[] | null) ?? [],
      misconceptions: (lesson.misconceptions as { misconception: string; response: string }[] | null) ?? [],
    },
  };

  const results: (QuestionAttempt & { question: Question })[] = [];
  let scoreSum = 0;
  let maxScoreSum = 0;

  for (const question of questions) {
    maxScoreSum += question.maxScore;
    const existing = await prisma.questionAttempt.findFirst({
      where: { activityAttemptId: activity.id, questionId: question.id },
      orderBy: { attemptNumber: "desc" },
    });

    let row: QuestionAttempt;
    if (existing && existing.gradedBy !== "PENDING") {
      // Already graded — immutable, do not re-grade on resubmit.
      row = existing;
    } else if (existing && existing.gradedBy === "PENDING") {
      const graded = await gradeQuestion(question, existing.response, ctx);
      row = await prisma.questionAttempt.update({
        where: { id: existing.id },
        data: {
          gradedBy: graded.gradedBy,
          gradedAt: new Date(),
          isCorrect: graded.correct,
          score: graded.score,
          maxScore: graded.maxScore,
          mastery: graded.mastery,
          feedback: graded.feedbackForStudent,
          reasoning: graded.reasoningForParent,
          misconceptions: graded.misconceptions,
          needsReview: graded.needsReview,
          gradingRaw: (graded.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } else {
      // No draft was ever saved: treat as an empty, incorrect response (score 0).
      row = await prisma.questionAttempt.create({
        data: {
          activityAttemptId: activity.id,
          questionId: question.id,
          studentId,
          attemptNumber: 1,
          response: {} as Prisma.InputJsonValue,
          gradedBy: "DETERMINISTIC",
          gradedAt: new Date(),
          isCorrect: false,
          score: 0,
          maxScore: question.maxScore,
          mastery: 0,
          feedback: "No answer was given.",
          reasoning: "No answer was submitted for this question.",
          misconceptions: [],
          needsReview: false,
        },
      });
    }
    scoreSum += row.score ?? 0;
    results.push({ ...row, question });
  }

  const percentage = maxScoreSum > 0 ? (scoreSum / maxScoreSum) * 100 : null;
  const gradedActivity = await prisma.activityAttempt.update({
    where: { id: activity.id },
    data: {
      status: "GRADED",
      submittedAt: activity.submittedAt ?? new Date(),
      gradedAt: new Date(),
      score: scoreSum,
      maxScore: maxScoreSum,
      percentage,
    },
  });

  if (stage === "CHECK") {
    await recomputeMasteryScore(attempt.id);
  }

  await finalizeStageAdvance(attempt, stage, isCurrent);
  await afterActivityGraded(gradedActivity.id);

  // Review-assignment lessons redo the CHECK stage — close the loop back to the ReviewItem.
  if (stage === "CHECK" && attempt.assignmentId) {
    try {
      const assignment = await prisma.dailyAssignment.findUnique({ where: { id: attempt.assignmentId } });
      if (assignment?.kind === "REVIEW" && assignment.reviewItemId) {
        await completeReview(assignment.reviewItemId, percentage ?? 0);
      }
    } catch (err) {
      console.error("completeReview after CHECK submit failed", err);
    }
  }

  if (isCurrent && nextStage(stage) === "FEEDBACK") {
    try {
      const summary = await teacherAgent.summarizeLesson(attempt.id);
      await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { feedbackSummary: summary.forStudent } });
      if (summary.forParent) {
        await prisma.teacherFeedback.create({
          data: {
            studentId,
            lessonAttemptId: attempt.id,
            authorType: "AI",
            content: summary.forParent,
            visibleToStudent: false,
          },
        });
      }
    } catch (err) {
      // Never fail the submit because AI summarisation failed.
      console.error("summarizeLesson failed", err);
    }
  }

  return { activity: gradedActivity, results };
}

export async function retryQuestion(attemptId: string, studentId: string, questionId: string): Promise<void> {
  const attempt = await loadOwnedAttempt(attemptId, studentId);
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question || question.lessonId !== attempt.lessonId) throw new ApiError(404, "Question not found");
  const stage = question.stage;
  if (!isGradedStage(stage)) throw new ApiError(400, "Question is not retryable");

  const activity = await prisma.activityAttempt.findFirst({
    where: { lessonAttemptId: attempt.id, stage },
    orderBy: { attemptNumber: "desc" },
  });
  if (!activity || activity.status !== "GRADED") throw new ApiError(400, "Question has not been graded yet");

  const latest = await prisma.questionAttempt.findFirst({
    where: { activityAttemptId: activity.id, questionId },
    orderBy: { attemptNumber: "desc" },
  });
  if (!latest || latest.gradedBy === "PENDING") throw new ApiError(400, "Question has not been graded yet");
  if (latest.isCorrect) throw new ApiError(400, "This question was already answered correctly");

  if (stage === "CHECK") {
    const gradedCount = await countGradedAttempts(activity.id, questionId);
    if (gradedCount >= 2) throw new ApiError(400, "No retries remaining for this question");
  }

  await prisma.$transaction([
    prisma.questionAttempt.create({
      data: {
        activityAttemptId: activity.id,
        questionId,
        studentId,
        attemptNumber: latest.attemptNumber + 1,
        response: {} as Prisma.InputJsonValue,
        maxScore: question.maxScore,
        gradedBy: "PENDING",
      },
    }),
    prisma.activityAttempt.update({ where: { id: activity.id }, data: { status: "IN_PROGRESS" } }),
  ]);
}

export async function completeStage(attemptId: string, studentId: string, stage: LessonStage): Promise<LessonAttempt> {
  if (isGradedStage(stage)) throw new ApiError(400, "Use submitStage for graded stages");

  const attempt = await loadOwnedAttempt(attemptId, studentId);
  if (attempt.status !== "IN_PROGRESS") throw new ApiError(400, "Lesson attempt is not in progress");
  if (attempt.currentStage !== stage) throw new ApiError(400, "Stage mismatch");

  if (stage === "LEARN") {
    return prisma.lessonAttempt.update({
      where: { id: attempt.id },
      data: {
        instructionCompletedAt: attempt.instructionCompletedAt ?? new Date(),
        currentStage: nextStage(stage)!,
      },
    });
  }

  if (stage === "FEEDBACK") {
    return prisma.lessonAttempt.update({
      where: { id: attempt.id },
      data: { currentStage: nextStage(stage)! },
    });
  }

  // COMPLETE
  return finaliseAttempt(attempt);
}

/**
 * Marks an attempt finished: its status, its assignment, its progress row, its log line.
 *
 * Pulled out of `completeStage` because pressing Finish is not the only way a lesson ends. A
 * child who answered every question and closed the tab has finished the lesson; the button is
 * how they say so, not what makes it true. `settleFinishedLessons` uses this for the ones
 * nobody pressed.
 */
export async function finaliseAttempt(attempt: LessonAttempt): Promise<LessonAttempt> {
  const studentId = attempt.studentId;
  const assessedCount = await prisma.activityAttempt.count({
    where: { lessonAttemptId: attempt.id, stage: { in: ["PRACTICE", "CHECK"] }, status: "GRADED" },
  });
  const mastery = attempt.masteryScore;
  let status: LessonAttempt["status"] = "COMPLETED";
  if (mastery != null) {
    if (mastery >= 0.9 && assessedCount >= 2) status = "MASTERED";
    else if (mastery < 0.7) status = "NEEDS_REVIEW";
  }

  // Anything the tutoring loop opened and never closed is parked, not forgotten — it comes back
  // as review tomorrow. And a lesson finished with something still not understood is never
  // "mastered", whatever the arithmetic of the score says: the whole point of finding a gap is
  // that it counts for something.
  const parked = await parkOpenGaps(attempt.id, studentId).catch(() => 0);
  if (parked > 0 && status !== "NEEDS_REVIEW") status = "NEEDS_REVIEW";

  const updated = await prisma.lessonAttempt.update({
    where: { id: attempt.id },
    data: { completedAt: attempt.completedAt ?? new Date(), status, currentStage: "COMPLETE" },
  });

  if (attempt.assignmentId) {
    await prisma.dailyAssignment
      .update({ where: { id: attempt.assignmentId }, data: { status: "COMPLETED", completedAt: new Date() } })
      .catch(() => undefined);
  }

  await recomputeLessonProgress(studentId, attempt.lessonId);

  await prisma.activityLog.create({
    data: { studentId, kind: "lesson_completed", data: { lessonId: attempt.lessonId, attemptId: attempt.id, status } },
  });

  return updated;
}

/**
 * How long after the quiz is marked before an unfinished lesson counts as finished anyway.
 *
 * Long enough that a child reading their feedback, retrying a question, or doing the extra
 * practice is not cut off mid-thought; short enough that a lesson done this morning is on the
 * board as done by the next one.
 */
const SETTLE_AFTER_MINUTES = 15;

/**
 * Marks as done the lessons a child finished but never pressed Finish on.
 *
 * A child answered every question, scored full marks, and the lesson stayed "not started" on
 * her board — because the only thing that completed a lesson was a button, and for a while
 * that button was hidden whenever there was time left in the period. Bookkeeping should not be
 * able to un-do a lesson someone did.
 *
 * The rule is deliberately narrow: the quiz must have been marked, and a quarter of an hour
 * must have passed since. A lesson still being worked on is left alone.
 */
export async function settleFinishedLessons(studentId: string): Promise<number> {
  const cutoff = new Date(Date.now() - SETTLE_AFTER_MINUTES * 60 * 1000);

  const stale = await prisma.lessonAttempt.findMany({
    where: {
      studentId,
      status: "IN_PROGRESS",
      activities: { some: { stage: "CHECK", status: "GRADED", gradedAt: { lt: cutoff } } },
    },
    take: 20,
  });

  let settled = 0;
  for (const attempt of stale) {
    // Never fatal: a lesson that will not settle must not stop the board from rendering.
    await finaliseAttempt(attempt)
      .then(() => {
        settled += 1;
      })
      .catch(() => undefined);
  }
  return settled;
}

export async function recordVideoProgress(
  attemptId: string,
  studentId: string,
  p: { percentWatched: number; positionSeconds: number; completed: boolean }
): Promise<void> {
  const attempt = await loadOwnedAttempt(attemptId, studentId);
  const prior = (attempt.videoProgress ?? {}) as {
    started?: boolean;
    percentWatched?: number;
    positionSeconds?: number;
    completed?: boolean;
  };
  const videoProgress = {
    started: true,
    percentWatched: Math.max(prior.percentWatched ?? 0, p.percentWatched),
    positionSeconds: Math.max(prior.positionSeconds ?? 0, p.positionSeconds),
    completed: Boolean(prior.completed) || p.completed,
    updatedAt: new Date().toISOString(),
  };
  await prisma.lessonAttempt.update({
    where: { id: attempt.id },
    data: { videoProgress: videoProgress as Prisma.InputJsonValue },
  });
}

export async function recordTime(attemptId: string, studentId: string, seconds: number): Promise<void> {
  const attempt = await loadOwnedAttempt(attemptId, studentId);
  const capped = Math.max(0, Math.min(seconds, 600));
  if (capped === 0) return;
  await prisma.lessonAttempt.update({
    where: { id: attempt.id },
    data: { timeSpentSeconds: { increment: capped } },
  });
  await prisma.studentLessonProgress
    .update({
      where: { studentId_lessonId: { studentId, lessonId: attempt.lessonId } },
      data: { timeSpentSeconds: { increment: capped }, lastActivityAt: new Date() },
    })
    .catch(() => undefined);
}

// re-export for convenience within this module's neighbours
export { gradedStages };
