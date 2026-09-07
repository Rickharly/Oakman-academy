/**
 * Parent override service (spec §32-38, §54; ARCHITECTURE §1, §8; docs/CONTRACTS.md).
 *
 * Hard rule: nothing educational is ever deleted or overwritten. `QuestionAttempt` rows stay
 * exactly as the machine (deterministic grader / AI) left them. A parent decision is stored
 * as a *new* `ParentOverride` row carrying both `previousValue` (what the machine decided) and
 * `newValue` (the parent's decision); every place that needs "the real answer" — the inspection
 * view, the rollups below — reads the override on top of the machine record via `effectiveGrade`,
 * never by mutating the original row. The one sanctioned exception is `Question.excluded`
 * (ARCHITECTURE §1), which the parent may flip directly.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type {
  ActivityAttempt,
  LessonStage,
  ParentOverride,
  OverrideType,
  QuestionAttempt,
} from "@/generated/prisma/client";
import { ApiError } from "@/lib/auth/api";
import { STAGES, stageIndex, stageTimestampField } from "@/lib/lessons/stages";
import { recomputeLessonProgress } from "@/lib/progress/aggregate";

export interface ApplyOverrideInput {
  studentId: string;
  type: OverrideType;
  questionAttemptId?: string;
  lessonAttemptId?: string;
  lessonId?: string;
  questionId?: string;
  value?: unknown;
  comment?: string;
}

export interface EffectiveGrade {
  score: number | null;
  maxScore: number;
  isCorrect: boolean | null;
  overridden: boolean;
  /** The override that produced this value, when `overridden` is true. */
  override: ParentOverride | null;
}

/**
 * The grade the parent dashboard (and the rollups below) should treat as true for one
 * `QuestionAttempt`: the machine's own value, unless a SCORE/MARK_CORRECT override exists for
 * it, in which case the latest such override wins. `overrides` may be any superset (e.g. every
 * override for a lesson) — this filters to the ones relevant to `attempt`.
 */
export function effectiveGrade(attempt: QuestionAttempt, overrides: ParentOverride[]): EffectiveGrade {
  const relevant = overrides
    .filter(
      (o) => o.questionAttemptId === attempt.id && (o.type === "SCORE" || o.type === "MARK_CORRECT")
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const latest = relevant[0];
  if (!latest) {
    return { score: attempt.score, maxScore: attempt.maxScore, isCorrect: attempt.isCorrect, overridden: false, override: null };
  }

  if (latest.type === "MARK_CORRECT") {
    return { score: attempt.maxScore, maxScore: attempt.maxScore, isCorrect: true, overridden: true, override: latest };
  }

  const newValue = (latest.newValue ?? {}) as { score?: number };
  const score = Math.max(0, Math.min(attempt.maxScore, Number(newValue.score ?? 0)));
  return {
    score,
    maxScore: attempt.maxScore,
    isCorrect: attempt.maxScore > 0 ? score >= attempt.maxScore : null,
    overridden: true,
    override: latest,
  };
}

// ───────────────────────────── rollup recomputation ─────────────────────────────

/**
 * Recomputes one `ActivityAttempt`'s score/maxScore/percentage from the current
 * (override- and exclusion-aware) effective grade of its latest attempt per question.
 * Never touches `QuestionAttempt` rows.
 */
async function recomputeActivityAggregate(activityAttemptId: string): Promise<ActivityAttempt> {
  const activity = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: activityAttemptId } });
  const attempts = await prisma.questionAttempt.findMany({
    where: { activityAttemptId, gradedBy: { not: "PENDING" } },
    include: { question: true },
    orderBy: { attemptNumber: "asc" },
  });

  // Latest graded attempt per question, skipping excluded questions entirely.
  const latestByQuestion = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) {
    if (a.question.excluded) continue;
    latestByQuestion.set(a.questionId, a);
  }

  if (latestByQuestion.size === 0) {
    return prisma.activityAttempt.update({
      where: { id: activityAttemptId },
      data: { score: 0, maxScore: 0, percentage: activity.status === "GRADED" ? null : activity.percentage },
    });
  }

  const overrides = await prisma.parentOverride.findMany({
    where: { questionAttemptId: { in: [...latestByQuestion.values()].map((a) => a.id) } },
  });

  let scoreSum = 0;
  let maxScoreSum = 0;
  for (const attempt of latestByQuestion.values()) {
    const effective = effectiveGrade(attempt, overrides);
    scoreSum += effective.score ?? 0;
    maxScoreSum += effective.maxScore;
  }
  const percentage = maxScoreSum > 0 ? (scoreSum / maxScoreSum) * 100 : null;

  return prisma.activityAttempt.update({
    where: { id: activityAttemptId },
    data: { score: scoreSum, maxScore: maxScoreSum, percentage },
  });
}

/** Mirrors the CHECK/PRACTICE blend in `lessons/service.ts` (0.8 × CHECK% + 0.2 × PRACTICE%). */
async function recomputeLessonAttemptMastery(lessonAttemptId: string): Promise<number | null> {
  const checkActivity = await prisma.activityAttempt.findFirst({
    where: { lessonAttemptId, stage: "CHECK", status: "GRADED" },
    orderBy: { attemptNumber: "desc" },
  });
  if (!checkActivity) return null;
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
  return masteryScore;
}

async function writeMasteryRecord(
  studentId: string,
  lessonId: string,
  mastery: number,
  previousMastery: number | null,
  sourceId: string
): Promise<void> {
  await prisma.masteryRecord.create({
    data: { studentId, lessonId, mastery, previousMastery, confidence: 0.9, reason: "parent_override", sourceId },
  });
}

// ───────────────────────────── override handlers ─────────────────────────────

async function loadQuestionAttempt(id: string | undefined) {
  if (!id) throw new ApiError(400, "questionAttemptId is required for this override type");
  const attempt = await prisma.questionAttempt.findUnique({
    where: { id },
    include: { activityAttempt: { include: { lessonAttempt: true } } },
  });
  if (!attempt) throw new ApiError(404, "Question attempt not found");
  return attempt;
}

async function handleScoreOrMarkCorrect(parentId: string, input: ApplyOverrideInput): Promise<ParentOverride> {
  const qa = await loadQuestionAttempt(input.questionAttemptId);
  const lessonAttempt = qa.activityAttempt.lessonAttempt;
  if (lessonAttempt.studentId !== input.studentId) throw new ApiError(403, "Question attempt does not belong to this student");

  const previousValue = { score: qa.score, isCorrect: qa.isCorrect, maxScore: qa.maxScore };
  let newValue: Prisma.InputJsonValue;
  if (input.type === "MARK_CORRECT") {
    newValue = { score: qa.maxScore, isCorrect: true };
  } else {
    const raw = Number(input.value);
    if (!Number.isFinite(raw)) throw new ApiError(400, "value must be a number for a SCORE override");
    const score = Math.max(0, Math.min(qa.maxScore, raw));
    newValue = { score };
  }

  const override = await prisma.parentOverride.create({
    data: {
      parentId,
      studentId: input.studentId,
      type: input.type,
      questionAttemptId: qa.id,
      lessonAttemptId: lessonAttempt.id,
      lessonId: lessonAttempt.lessonId,
      questionId: qa.questionId,
      previousValue: previousValue as Prisma.InputJsonValue,
      newValue,
      comment: input.comment ?? null,
    },
  });

  await recomputeActivityAggregate(qa.activityAttemptId);
  const previousMastery = lessonAttempt.masteryScore;
  const mastery = await recomputeLessonAttemptMastery(lessonAttempt.id);
  await recomputeLessonProgress(input.studentId, lessonAttempt.lessonId);
  if (mastery != null && mastery !== previousMastery) {
    await writeMasteryRecord(input.studentId, lessonAttempt.lessonId, mastery, previousMastery, override.id);
  }

  return override;
}

async function handleMastery(parentId: string, input: ApplyOverrideInput): Promise<ParentOverride> {
  if (!input.lessonId) throw new ApiError(400, "lessonId is required for a MASTERY override");
  const raw = Number(input.value);
  if (!Number.isFinite(raw)) throw new ApiError(400, "value must be a number (0-1) for a MASTERY override");
  const mastery = Math.max(0, Math.min(1, raw));

  const lessonAttempt = input.lessonAttemptId
    ? await prisma.lessonAttempt.findUnique({ where: { id: input.lessonAttemptId } })
    : await prisma.lessonAttempt.findFirst({
        where: { studentId: input.studentId, lessonId: input.lessonId },
        orderBy: { attemptNumber: "desc" },
      });
  if (!lessonAttempt || lessonAttempt.studentId !== input.studentId) {
    throw new ApiError(404, "No lesson attempt found for this student/lesson");
  }

  const previousMastery = lessonAttempt.masteryScore;

  const override = await prisma.parentOverride.create({
    data: {
      parentId,
      studentId: input.studentId,
      type: "MASTERY",
      lessonAttemptId: lessonAttempt.id,
      lessonId: input.lessonId,
      previousValue: { mastery: previousMastery } as Prisma.InputJsonValue,
      newValue: { mastery } as Prisma.InputJsonValue,
      comment: input.comment ?? null,
    },
  });

  await prisma.lessonAttempt.update({ where: { id: lessonAttempt.id }, data: { masteryScore: mastery } });
  await recomputeLessonProgress(input.studentId, input.lessonId);
  await writeMasteryRecord(input.studentId, input.lessonId, mastery, previousMastery, override.id);

  return override;
}

async function handleLessonComplete(parentId: string, input: ApplyOverrideInput): Promise<ParentOverride> {
  if (!input.lessonAttemptId) throw new ApiError(400, "lessonAttemptId is required for a LESSON_COMPLETE override");
  const lessonAttempt = await prisma.lessonAttempt.findUnique({ where: { id: input.lessonAttemptId } });
  if (!lessonAttempt || lessonAttempt.studentId !== input.studentId) throw new ApiError(404, "Lesson attempt not found");

  const previousValue = { status: lessonAttempt.status, completedAt: lessonAttempt.completedAt, currentStage: lessonAttempt.currentStage };
  const status = lessonAttempt.status === "MASTERED" ? "MASTERED" : "COMPLETED";
  const completedAt = lessonAttempt.completedAt ?? new Date();

  const override = await prisma.parentOverride.create({
    data: {
      parentId,
      studentId: input.studentId,
      type: "LESSON_COMPLETE",
      lessonAttemptId: lessonAttempt.id,
      lessonId: lessonAttempt.lessonId,
      previousValue: previousValue as Prisma.InputJsonValue,
      newValue: { status, completedAt } as Prisma.InputJsonValue,
      comment: input.comment ?? null,
    },
  });

  await prisma.lessonAttempt.update({
    where: { id: lessonAttempt.id },
    data: { status, completedAt, currentStage: "COMPLETE" },
  });
  if (lessonAttempt.assignmentId) {
    await prisma.dailyAssignment
      .update({ where: { id: lessonAttempt.assignmentId }, data: { status: "COMPLETED", completedAt } })
      .catch(() => undefined);
  }
  await recomputeLessonProgress(input.studentId, lessonAttempt.lessonId);

  return override;
}

async function handleResetQuiz(parentId: string, input: ApplyOverrideInput): Promise<ParentOverride> {
  if (!input.lessonAttemptId) throw new ApiError(400, "lessonAttemptId is required for a RESET_QUIZ override");
  const lessonAttempt = await prisma.lessonAttempt.findUnique({ where: { id: input.lessonAttemptId } });
  if (!lessonAttempt || lessonAttempt.studentId !== input.studentId) throw new ApiError(404, "Lesson attempt not found");

  const previousValue = {
    currentStage: lessonAttempt.currentStage,
    status: lessonAttempt.status,
    assessmentCompletedAt: lessonAttempt.assessmentCompletedAt,
    completedAt: lessonAttempt.completedAt,
  };

  const override = await prisma.parentOverride.create({
    data: {
      parentId,
      studentId: input.studentId,
      type: "RESET_QUIZ",
      lessonAttemptId: lessonAttempt.id,
      lessonId: lessonAttempt.lessonId,
      previousValue: previousValue as Prisma.InputJsonValue,
      newValue: { currentStage: "CHECK", status: "IN_PROGRESS" } as Prisma.InputJsonValue,
      comment: input.comment ?? null,
    },
  });

  // The graded CHECK ActivityAttempt is left exactly as-is (immutable history); the
  // lesson service's `saveDraftAnswer` opens the next attemptNumber once the student
  // starts answering again, because the latest activity for the stage is GRADED.
  await prisma.lessonAttempt.update({
    where: { id: lessonAttempt.id },
    data: { currentStage: "CHECK", status: "IN_PROGRESS", completedAt: null },
  });
  await recomputeLessonProgress(input.studentId, lessonAttempt.lessonId);

  return override;
}

async function handleReopenLesson(parentId: string, input: ApplyOverrideInput): Promise<ParentOverride> {
  if (!input.lessonAttemptId) throw new ApiError(400, "lessonAttemptId is required for a REOPEN_LESSON override");
  const targetStage = input.value as LessonStage;
  if (!STAGES.includes(targetStage)) throw new ApiError(400, "value must be a valid lesson stage");

  const lessonAttempt = await prisma.lessonAttempt.findUnique({ where: { id: input.lessonAttemptId } });
  if (!lessonAttempt || lessonAttempt.studentId !== input.studentId) throw new ApiError(404, "Lesson attempt not found");

  const previousValue = { currentStage: lessonAttempt.currentStage, status: lessonAttempt.status, completedAt: lessonAttempt.completedAt };

  const override = await prisma.parentOverride.create({
    data: {
      parentId,
      studentId: input.studentId,
      type: "REOPEN_LESSON",
      lessonAttemptId: lessonAttempt.id,
      lessonId: lessonAttempt.lessonId,
      previousValue: previousValue as Prisma.InputJsonValue,
      newValue: { currentStage: targetStage, status: "IN_PROGRESS" } as Prisma.InputJsonValue,
      comment: input.comment ?? null,
    },
  });

  // Clear the stamped-completion timestamps for the target stage and everything after it,
  // so the lesson player treats them as not-yet-done again.
  const fromIdx = stageIndex(targetStage);
  const data: Prisma.LessonAttemptUpdateInput = { currentStage: targetStage, status: "IN_PROGRESS", completedAt: null };
  for (const stage of STAGES.slice(fromIdx)) {
    const field = stageTimestampField(stage);
    if (field) (data as Record<string, unknown>)[field] = null;
  }
  await prisma.lessonAttempt.update({ where: { id: lessonAttempt.id }, data });
  await recomputeLessonProgress(input.studentId, lessonAttempt.lessonId);

  if (lessonAttempt.assignmentId) {
    await prisma.dailyAssignment
      .update({ where: { id: lessonAttempt.assignmentId }, data: { status: "IN_PROGRESS", completedAt: null } })
      .catch(() => undefined);
  }

  return override;
}

async function handleExcludeQuestion(parentId: string, input: ApplyOverrideInput): Promise<ParentOverride> {
  if (!input.questionId) throw new ApiError(400, "questionId is required for an EXCLUDE_QUESTION override");
  const question = await prisma.question.findUnique({ where: { id: input.questionId } });
  if (!question) throw new ApiError(404, "Question not found");

  const previousValue = { excluded: question.excluded };

  const override = await prisma.parentOverride.create({
    data: {
      parentId,
      studentId: input.studentId,
      type: "EXCLUDE_QUESTION",
      lessonId: question.lessonId,
      questionId: question.id,
      previousValue: previousValue as Prisma.InputJsonValue,
      newValue: { excluded: true } as Prisma.InputJsonValue,
      comment: input.comment ?? null,
    },
  });

  // Sanctioned exception (ARCHITECTURE §1): the parent may flip Question.excluded directly.
  await prisma.question.update({ where: { id: question.id }, data: { excluded: true } });

  // Recompute every activity (across every lesson attempt) that graded this question, so
  // scores/mastery stop counting it — without touching the QuestionAttempt rows themselves.
  const affectedAttempts = await prisma.questionAttempt.findMany({
    where: { studentId: input.studentId, questionId: question.id },
    select: { activityAttemptId: true },
  });
  const activityIds = [...new Set(affectedAttempts.map((a) => a.activityAttemptId))];
  const affectedLessonAttemptIds = new Set<string>();
  for (const activityAttemptId of activityIds) {
    const activity = await recomputeActivityAggregate(activityAttemptId);
    affectedLessonAttemptIds.add(activity.lessonAttemptId);
  }
  for (const lessonAttemptId of affectedLessonAttemptIds) {
    const lessonAttempt = await prisma.lessonAttempt.findUnique({ where: { id: lessonAttemptId } });
    if (!lessonAttempt) continue;
    const previousMastery = lessonAttempt.masteryScore;
    const mastery = await recomputeLessonAttemptMastery(lessonAttemptId);
    if (mastery != null && mastery !== previousMastery) {
      await writeMasteryRecord(input.studentId, question.lessonId, mastery, previousMastery, override.id);
    }
  }
  await recomputeLessonProgress(input.studentId, question.lessonId);

  return override;
}

async function handleComment(parentId: string, input: ApplyOverrideInput): Promise<ParentOverride> {
  if (!input.comment || !input.comment.trim()) throw new ApiError(400, "comment is required for a COMMENT override");

  const override = await prisma.parentOverride.create({
    data: {
      parentId,
      studentId: input.studentId,
      type: "COMMENT",
      questionAttemptId: input.questionAttemptId ?? null,
      lessonAttemptId: input.lessonAttemptId ?? null,
      lessonId: input.lessonId ?? null,
      questionId: input.questionId ?? null,
      comment: input.comment,
    },
  });

  await prisma.teacherFeedback.create({
    data: {
      studentId: input.studentId,
      lessonAttemptId: input.lessonAttemptId ?? null,
      authorType: "PARENT",
      authorId: parentId,
      content: input.comment,
      visibleToStudent: true,
    },
  });

  return override;
}

/**
 * Applies one parent decision. Every branch writes a `ParentOverride` first (or as part of
 * the same logical step) so the decision is recorded even if a caller inspects mid-flight;
 * derived rollups (`ActivityAttempt`, `LessonAttempt`, `StudentLessonProgress`, `MasteryRecord`)
 * are then recomputed from the machine record + the override, never by rewriting the machine
 * record itself.
 */
export async function applyOverride(parentId: string, input: ApplyOverrideInput): Promise<ParentOverride> {
  switch (input.type) {
    case "SCORE":
    case "MARK_CORRECT":
      return handleScoreOrMarkCorrect(parentId, input);
    case "MASTERY":
      return handleMastery(parentId, input);
    case "LESSON_COMPLETE":
      return handleLessonComplete(parentId, input);
    case "RESET_QUIZ":
      return handleResetQuiz(parentId, input);
    case "REOPEN_LESSON":
      return handleReopenLesson(parentId, input);
    case "EXCLUDE_QUESTION":
      return handleExcludeQuestion(parentId, input);
    case "COMMENT":
      return handleComment(parentId, input);
    default:
      throw new ApiError(400, `Unknown override type: ${input.type as string}`);
  }
}
