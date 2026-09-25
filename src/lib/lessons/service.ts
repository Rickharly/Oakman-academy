/**
 * Lesson flow service (spec §10; ARCHITECTURE §4). Owns `LessonAttempt` /
 * `ActivityAttempt` / `QuestionAttempt` state transitions. See docs/CONTRACTS.md
 * for the exact exported signatures.
 */
import { prisma } from "@/lib/db";
import { plainQuestion } from "@/lib/questions/display";
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
import { schoolDayKey, schoolDayStart, todayDateOnly } from "@/lib/dates";
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
 * Only accepts an assignment that is genuinely this student's slot for this lesson — otherwise
 * the id is dropped as if none had been given.
 *
 * Every write keyed off an assignment id used to trust it outright (`where: { id }`), so a
 * student who knew or guessed another student's assignment id could tick that student's slot, or
 * tie their own attempt to a lesson that was not what the assignment named. `kind` is checked too:
 * a LESSON slot re-teaches the lesson, a REVIEW slot re-runs its CHECK — both legitimately name
 * this lesson; a READING or CUSTOM row never does.
 */
async function ownedLessonAssignmentId(
  studentId: string,
  lessonId: string,
  assignmentId: string | null | undefined
): Promise<string | null> {
  if (!assignmentId) return null;
  const assignment = await prisma.dailyAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return null;
  if (assignment.studentId !== studentId) return null;
  if (assignment.lessonId !== lessonId) return null;
  if (assignment.kind !== "LESSON" && assignment.kind !== "REVIEW") return null;
  return assignment.id;
}

/**
 * Latest ActivityAttempt for a stage, for drafting: reused while it is still open — including
 * one `retryQuestion` reopened for one more try, which is the only thing that flips a GRADED
 * activity back to IN_PROGRESS.
 *
 * If the latest round is already GRADED, nothing legitimate is asking to save into it: no retry
 * was requested (that would have flipped it back to IN_PROGRESS already), so this is a stray
 * write — a renderer firing an answer's onChange on mount after a reload is the one we have
 * seen. Opening a fresh, empty round for that would silently zero out a graded stage under the
 * child; refusing is a no-op instead.
 */
async function getOrOpenActivity(lessonAttemptId: string, stage: GradedStage): Promise<ActivityAttempt> {
  const latest = await prisma.activityAttempt.findFirst({
    where: { lessonAttemptId, stage },
    orderBy: { attemptNumber: "desc" },
  });
  if (!latest) {
    return prisma.activityAttempt.create({ data: { lessonAttemptId, stage, attemptNumber: 1, status: "IN_PROGRESS" } });
  }
  if (latest.status === "GRADED") {
    throw new ApiError(409, "This stage has already been graded.");
  }
  return latest;
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

/**
 * The `where` fragment for "this activity counts as graded", including one `retryQuestion`
 * reopened for a single question. Retrying flips the whole activity's status to IN_PROGRESS so
 * drafting targets the right round, but the round was genuinely graded once (`gradedAt` is
 * still set from that pass) and stays so if the child never gets back to the retry — reloading
 * before answering it must not make the CHECK look never marked. `completeStage(COMPLETE)`,
 * `finaliseAttempt`'s mastery-eligibility count, and `settleFinishedLessons` all use this so an
 * interrupted retry cannot dead-end the lesson; none of it re-grades anything, it only stops
 * treating a round that was graded once as if it never was.
 */
function gradedIncludingReopenedRetry(stage: LessonStage | LessonStage[]) {
  return {
    stage: Array.isArray(stage) ? { in: stage } : stage,
    OR: [{ status: "GRADED" as const }, { status: "IN_PROGRESS" as const, gradedAt: { not: null } }],
  };
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

/**
 * Advances the attempt off PRACTICE as a side effect of extra-practice work actually being
 * graded (`POST /api/lessons/[lessonId]/practice/submit`), instead of leaving the advance to a
 * second, separate request the browser happens to make afterwards. Stamps `practiceCompletedAt`
 * and sets `currentStage` to CHECK exactly the way `submitStage("PRACTICE")` would — it reuses
 * `finalizeStageAdvance` so an attempt advanced this way is indistinguishable from one advanced
 * the ordinary way.
 *
 * A no-op unless the attempt is genuinely still sitting on PRACTICE. Extra practice is also
 * taken from FEEDBACK or COMPLETE — the "extra round" (`practiseMore`/`practiseWeakSpots`/
 * `takeFinalTest` in `LessonPlayer.tsx`) that runs after the lesson is already marked — and in
 * that case the child is revisiting, not progressing, so `currentStage` must be left exactly as
 * it is.
 *
 * The attempt is re-read fresh rather than trusting the caller's copy, so this stays idempotent
 * and never fights a concurrent caller: called again after the stage has already moved on — the
 * browser's own `submitGraded("PRACTICE")` follow-up racing this, or the child submitting a
 * second round of extra practice — it sees `currentStage` is no longer PRACTICE and does nothing.
 */
export async function advanceFromExtraPractice(lessonAttemptId: string): Promise<void> {
  const attempt = await prisma.lessonAttempt.findUnique({ where: { id: lessonAttemptId } });
  if (!attempt || attempt.currentStage !== "PRACTICE") return;
  await finalizeStageAdvance(attempt, "PRACTICE", true);
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

/**
 * Deliberately no settling for a lesson abandoned before PRACTICE is done.
 *
 * An attempt stuck at STARTER or partway through LEARN is not a bug to close off: it is not
 * done, so the planner correctly keeps offering the lesson, and `existing` below is returned
 * exactly as it was left — same `currentStage`, same drafts — so opening it resumes the teaching
 * where the child stopped, rather than restarting or skipping to a quiz on material they never
 * saw. See `settleAbandonedLessons` for the narrower case (taught and practised, only the CHECK
 * missing) that *is* settled, and why forcing a status here instead would be worse than the
 * lesson simply coming back.
 */
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

  // Only ever trust an assignment id that is genuinely this student's slot for this lesson.
  const safeAssignmentId = await ownedLessonAssignmentId(studentId, lessonId, assignmentId);

  const existing = await prisma.lessonAttempt.findFirst({
    where: { studentId, lessonId, status: "IN_PROGRESS" },
    orderBy: { attemptNumber: "desc" },
  });
  if (existing) {
    // A child who started via "Start the next lesson" (no assignment id) may still land back on
    // today's board under this exact lesson later — via its LESSON card, or a REVIEW slot for
    // it. Attach the slot now so completion (below, and in `finaliseAttempt`) has something to
    // tick, the same as if they had opened it from the board in the first place.
    if (safeAssignmentId && existing.assignmentId !== safeAssignmentId) {
      await prisma.lessonAttempt.update({ where: { id: existing.id }, data: { assignmentId: safeAssignmentId } });
      existing.assignmentId = safeAssignmentId;
    }
    if (safeAssignmentId) {
      await prisma.dailyAssignment.updateMany({
        where: { id: safeAssignmentId, status: "PLANNED" },
        data: { status: "IN_PROGRESS" },
      });
    }
    return existing;
  }

  const priorCount = await prisma.lessonAttempt.count({ where: { studentId, lessonId } });

  const attempt = await prisma.lessonAttempt.create({
    data: {
      studentId,
      lessonId,
      assignmentId: safeAssignmentId,
      attemptNumber: priorCount + 1,
      status: "IN_PROGRESS",
      currentStage: "STARTER",
    },
  });

  if (safeAssignmentId) {
    await prisma.dailyAssignment.updateMany({
      where: { id: safeAssignmentId, status: "PLANNED" },
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
    // Read on the way out, never on the way in: the stored question keeps the provider's own
    // words, and what a child sees is that made legible. A maths question arriving as
    // `$$\frac{3}{4}$$` is not a question anybody can answer.
    questionsByStage[q.stage as "STARTER" | "PRACTICE" | "CHECK"].push(plainQuestion(rest));
  }

  const activities = await prisma.activityAttempt.findMany({
    where: { lessonAttemptId: attempt.id },
    include: { questionAttempts: true },
    orderBy: { startedAt: "asc" },
  });

  /**
   * What the player pre-fills each question with: the child's own latest answer, whether it is
   * still a live draft or has already been graded.
   *
   * This used to keep only PENDING responses, on the assumption a graded question shows its
   * answer some other way. It doesn't — the renderer is handed `value`, and a graded question
   * with nothing in `drafts` renders with no answer at all, disabled, next to feedback saying
   * "well done, that's correct" for a choice the child can no longer see. So every question's
   * latest response is kept here, regardless of grading state; the renderer's own `disabled`
   * (driven by whether the *stage* has been submitted) is what stops a restored value from ever
   * being written back as a fresh answer — this only supplies what to show, never what to save.
   *
   * `attemptNumber` counts retries *within one activity* (`saveDraftAnswer`/`retryQuestion` both
   * scope it to `{ activityAttemptId, questionId }`), so it cannot be compared across different
   * activities for the same question — an activity's own first attempt is always `1`, whichever
   * activity it is. `activities` is ordered oldest-first, so resolving attempt-number ties
   * *within* each activity and then simply overwriting question-by-question as later activities
   * are processed gives the chronologically latest answer either way.
   */
  const drafts: Record<string, unknown> = {};
  for (const activity of activities) {
    const latestInActivity = new Map<string, { attemptNumber: number; response: unknown }>();
    for (const qa of activity.questionAttempts) {
      const seen = latestInActivity.get(qa.questionId);
      if (!seen || qa.attemptNumber > seen.attemptNumber) {
        latestInActivity.set(qa.questionId, { attemptNumber: qa.attemptNumber, response: qa.response });
      }
    }
    for (const [questionId, entry] of latestInActivity) {
      drafts[questionId] = entry.response;
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

/**
 * Marks today's period done. Idempotent, and it never touches a period somebody already closed.
 *
 * Called the moment a CHECK is marked, because that is when the child finished the lesson —
 * not when they later find and press a button on the feedback screen.
 *
 * `fallback` covers a lesson started without an assignment id at all — "Start the next lesson"
 * from Today. It may still be sitting on today's board under its own LESSON slot; that is the
 * card the child is actually looking at, so find and tick that instead of leaving it stuck on
 * "not started" for having been begun the other way in.
 */
async function tickTheBoard(
  assignmentId: string | null,
  fallback?: { studentId: string; lessonId: string }
): Promise<void> {
  let id = assignmentId;
  if (!id && fallback) {
    const todays = await prisma.dailyAssignment.findFirst({
      where: {
        studentId: fallback.studentId,
        lessonId: fallback.lessonId,
        kind: "LESSON",
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        date: todayDateOnly(),
      },
    });
    id = todays?.id ?? null;
  }
  if (!id) return;
  await prisma.dailyAssignment
    .updateMany({
      where: { id, status: { in: ["PLANNED", "IN_PROGRESS"] } },
      data: { status: "COMPLETED", completedAt: new Date() },
    })
    .catch(() => undefined);
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
    // An activity for this stage may already exist — a PRACTICE round created by
    // /practice/submit, or a stage that had visible questions when it was opened and lost every
    // one of them to an exclusion since. Creating a fresh row with `attemptNumber: 1` unchecked
    // used to collide with it (`@@unique([lessonAttemptId, stage, attemptNumber])`) and 500 —
    // the stage must advance instead.
    const existingActivity = await prisma.activityAttempt.findFirst({
      where: { lessonAttemptId: attempt.id, stage },
      orderBy: { attemptNumber: "desc" },
    });
    const activity =
      existingActivity && existingActivity.status === "GRADED"
        ? existingActivity // already graded elsewhere — nothing new to grade, just move on
        : existingActivity
          ? await prisma.activityAttempt.update({
              where: { id: existingActivity.id },
              data: {
                status: "GRADED",
                submittedAt: existingActivity.submittedAt ?? new Date(),
                gradedAt: new Date(),
                score: existingActivity.score ?? 0,
                maxScore: existingActivity.maxScore ?? 0,
                percentage: existingActivity.percentage ?? null,
              },
            })
          : await prisma.activityAttempt.create({
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
    // A quiz with nothing in it is still a quiz they got to the end of.
    if (stage === "CHECK") await tickTheBoard(attempt.assignmentId, { studentId, lessonId: attempt.lessonId });
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

  /**
   * All the questions at once, not one after another.
   *
   * Marking was a loop: question one graded, then question two, then question three, each its
   * own call to a model taking several seconds. Five questions and a child is sitting in front
   * of a button that has done nothing visible for the best part of a minute, so they press it
   * again, and again. They are not being impatient — nothing told them it had started.
   *
   * The questions do not depend on each other, so there is no reason to make them queue.
   */
  const results: (QuestionAttempt & { question: Question })[] = [];
  let scoreSum = 0;
  let maxScoreSum = 0;

  const gradeOne = async (question: Question): Promise<QuestionAttempt & { question: Question }> => {
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
    return { ...row, question };
  };

  for (const row of await Promise.all(questions.map(gradeOne))) {
    maxScoreSum += row.question.maxScore;
    scoreSum += row.score ?? 0;
    results.push(row);
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

    /**
     * The tick belongs to the child the moment the quiz is marked.
     *
     * Finishing the work and being *recorded* as finishing it were two different events, and
     * the second one needed a button on a later screen. A child who did every question, got
     * their marks and went back to their board found it still saying "Continue" — so they had
     * finished the lesson and been told they had not. They are trying to complete the day and
     * the day will not let them.
     *
     * Everything after the quiz — reading the feedback, practising what they missed, the
     * tutoring loop — is worth doing and none of it is what makes the lesson done. The board
     * ticks here. `finaliseAttempt` still runs when they leave properly, and setting the same
     * row to the same value twice costs nothing.
     */
    await tickTheBoard(attempt.assignmentId, { studentId, lessonId: attempt.lessonId });
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

  /**
   * The end-of-lesson note is written after they are told their score, not before it.
   *
   * This was the last thing a submit did, and it is a whole model call of its own — so the
   * child's marks, which were ready, sat waiting on a paragraph nobody had asked for yet. Their
   * score and the feedback on every question come back now; the note follows a few seconds
   * later and the page picks it up.
   */
  if (isCurrent && nextStage(stage) === "FEEDBACK") {
    void writeLessonSummary(attempt.id, studentId).catch((err) => {
      console.error("summarizeLesson failed", err);
    });
  }

  return { activity: gradedActivity, results };
}

/** The teacher's note on the whole lesson. Runs behind the submit that triggered it. */
async function writeLessonSummary(attemptId: string, studentId: string): Promise<void> {
  const summary = await teacherAgent.summarizeLesson(attemptId);
  await prisma.lessonAttempt.update({
    where: { id: attemptId },
    data: { feedbackSummary: summary.forStudent },
  });
  if (summary.forParent) {
    await prisma.teacherFeedback.create({
      data: {
        studentId,
        lessonAttemptId: attemptId,
        authorType: "AI",
        content: summary.forParent,
        visibleToStudent: false,
      },
    });
  }
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

  /**
   * Finishing is idempotent, and it does not care which step the bookkeeping thinks you are on.
   *
   * A child who has answered every question and read their feedback has finished the lesson.
   * Whether the record says FEEDBACK or CHECK or COMPLETE is our problem, not theirs — and it
   * was being made theirs: pressing Finish sent two requests, each demanding the attempt be on
   * exactly the stage it named, and either one refusing meant "Stage mismatch" and a lesson
   * that stayed unfinished with everything on it green. Then it came round again the next day.
   *
   * So: finishing works from wherever they are once the quiz has been marked, and finishing an
   * already-finished lesson is a success, not an error. Nothing about a lesson someone has
   * done should depend on which of two buttons went through.
   */
  if (stage === "COMPLETE") {
    if (attempt.status !== "IN_PROGRESS") return attempt; // already done — say so happily
    const marked = await prisma.activityAttempt.count({
      where: { lessonAttemptId: attempt.id, ...gradedIncludingReopenedRetry("CHECK") },
    });
    if (marked === 0) throw new ApiError(400, "The quiz has not been marked yet.");
    return finaliseAttempt(attempt);
  }

  if (attempt.status !== "IN_PROGRESS") throw new ApiError(400, "Lesson attempt is not in progress");
  // Moving on from a step you have already left is not a failure; it is a repeated click.
  if (attempt.currentStage !== stage) {
    if (stageIndex(attempt.currentStage) > stageIndex(stage)) return attempt;
    throw new ApiError(400, "Stage mismatch");
  }

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
    where: { lessonAttemptId: attempt.id, ...gradedIncludingReopenedRetry(["PRACTICE", "CHECK"]) },
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

  // Tick whichever slot this belongs to — the attempt's own assignment, or (a lesson started
  // without one, e.g. "Start the next lesson" from Today) today's LESSON assignment for the
  // same lesson, if it's sitting on the board waiting for it.
  await tickTheBoard(attempt.assignmentId, { studentId, lessonId: attempt.lessonId });

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
 * board as done by the next one. The board itself ticks as soon as the quiz is marked — this is
 * only the backstop that closes the attempt behind them.
 */
const SETTLE_AFTER_MINUTES = 5;

/**
 * Marks as done the lessons a child finished but never pressed Finish on.
 *
 * A child answered every question, scored full marks, and the lesson stayed "not started" on
 * her board — because the only thing that completed a lesson was a button, and for a while
 * that button was hidden whenever there was time left in the period. Bookkeeping should not be
 * able to un-do a lesson someone did.
 *
 * The rule is deliberately narrow: the quiz must have been marked, and five minutes must have
 * passed since. A lesson still being worked on is left alone.
 */
export async function settleFinishedLessons(studentId: string): Promise<number> {
  const cutoff = new Date(Date.now() - SETTLE_AFTER_MINUTES * 60 * 1000);

  const stale = await prisma.lessonAttempt.findMany({
    where: {
      studentId,
      status: "IN_PROGRESS",
      // `status: "IN_PROGRESS"` here also matches a CHECK reopened for a retry the child never
      // came back to answer — it was graded (this is what `gradedAt` reports), just not
      // resubmitted. Without that, an interrupted retry never settles at all.
      activities: { some: { stage: "CHECK", status: { in: ["GRADED", "IN_PROGRESS"] }, gradedAt: { lt: cutoff } } },
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

/**
 * How long a lesson can sit untouched before it counts as given up on rather than mid-session.
 *
 * Not a raw duration: a school day has breaks in it, and a real gap between two periods of the
 * same sitting must not trip this. `LessonAttempt.updatedAt` moves every time the child's own
 * time-tracking (`recordTime`) ticks over their attempt, so a lesson still genuinely open today
 * keeps a fresh timestamp no matter how long today's gaps are. Only an attempt last touched
 * before *today's school day began* is a different day's business — tying the cutoff to the
 * school day, rather than to a fixed number of hours, is what makes that distinction exact.
 *
 * Always today, regardless of which day or week a caller is busy planning: this answers "is this
 * genuinely stale as of right now", not "is this stale relative to the day I'm about to fill in".
 */
function abandonedSince(): Date {
  return schoolDayStart(schoolDayKey());
}

/**
 * Marks NEEDS_REVIEW the lessons a child was genuinely taught and practised, and then never
 * came back to sit the CHECK for.
 *
 * This is deliberately narrower than "any abandoned attempt". An attempt abandoned at STARTER or
 * during LEARN needs none of this: it is not done, so the planner rightly offers the lesson
 * again, and `startOrResumeAttempt` resumes the *same* attempt at the *same* `currentStage` — a
 * child who stopped partway through the teaching picks the teaching back up, which is exactly
 * what should happen. Settling that attempt here — forcing NEEDS_REVIEW, which routes back as a
 * `runReviewAssignment` CHECK-only re-run — would hand a quiz on material the child was never
 * taught to someone who never saw it, and record them as having done the lesson when they have
 * not. The Learn step's own fallback copy already warns against exactly this: a child sent into
 * an assessment on material nobody gave them will believe the failure is theirs.
 *
 * So only an attempt with a graded (or submitted) PRACTICE round counts — genuinely taught, and
 * genuinely practised. An earlier version of this also matched any `currentStage` that had
 * already reached CHECK, meaning to catch "the stage advanced without a recorded PRACTICE
 * activity for some other reason" — but that branch turned out to be both redundant for an
 * ordinary lesson (every legitimate path to CHECK, including an empty PRACTICE stage and the
 * extra-practice route, always leaves a PRACTICE `ActivityAttempt` behind first) and actively
 * dangerous for a REVIEW assignment, whose attempt is forced straight to `currentStage: "CHECK"`
 * by `runReviewAssignment` with **no** PRACTICE round at all, by construction. That branch would
 * have caught a review opened and never answered — zero activities, nothing to show for it — and
 * marked it NEEDS_REVIEW as though it had been taught and practised. It has been removed; a
 * review attempt is additionally excluded outright below, so nothing about this function ever
 * reasons about a review's `currentStage` again. A stale review is settled by
 * `requeueAbandonedReviews` instead, on the `ReviewItem` itself — see its comment for why that is
 * the right unit for a review's obligation.
 *
 * For a genuinely taught-and-practised, CHECK-abandoned lesson, `settleFinishedLessons` cannot
 * see the gap at all — it only settles an attempt whose CHECK has actually been graded, and one
 * abandoned before CHECK has no such thing to find. Left alone, the `LessonAttempt` would stay
 * IN_PROGRESS forever and `StudentLessonProgress` with it — `isLessonDone` never returns true for
 * it — so the planner would offer the same lesson again indefinitely even though there is nothing
 * left to teach, only a quiz left to sit.
 *
 * The honest middle ground: not COMPLETED (nobody watched them finish — that is the point of the
 * CHECK), and not left open forever either (the teaching and the practice genuinely happened, and
 * are genuinely behind them). NEEDS_REVIEW is this app's existing word for "done, but come back
 * to it" — the same status a poor CHECK score already gets — so it is settled the exact same way:
 * one short REVIEW item re-runs just the CHECK, once.
 *
 * A lesson that keeps being abandoned before PRACTICE, on the other hand, can legitimately keep
 * reappearing — that is unresolved by design, not missed: see the note on `startOrResumeAttempt`.
 */
export async function settleAbandonedLessons(studentId: string): Promise<number> {
  const cutoff = abandonedSince();

  const stale = await prisma.lessonAttempt.findMany({
    where: {
      studentId,
      status: "IN_PROGRESS",
      updatedAt: { lt: cutoff },
      // A CHECK that was actually graded is `settleFinishedLessons`'s to settle, on its own much
      // shorter clock — it has a real result to record, not just an absence of one.
      NOT: { activities: { some: { stage: "CHECK", gradedAt: { not: null } } } },
      activities: { some: { stage: "PRACTICE", status: { in: ["SUBMITTED", "GRADED"] } } },
      // Excluded outright, not merely left to fail the PRACTICE check above: a REVIEW
      // assignment's attempt never has a PRACTICE round by construction, so it would already be
      // excluded — but a review is not "a lesson abandoned before its quiz", it is *only* a quiz,
      // and reasoning about it here at all is the mistake, not just this particular condition.
      // `isNot` matches both "no assignment" (an attempt started without one) and "an assignment
      // that isn't a review".
      assignment: { isNot: { kind: "REVIEW" } },
    },
    take: 20,
  });

  let settled = 0;
  for (const attempt of stale) {
    // Never fatal: a lesson that will not settle must not stop the board from rendering.
    await settleOneAbandonedLesson(attempt)
      .then(() => {
        settled += 1;
      })
      .catch(() => undefined);
  }
  return settled;
}

async function settleOneAbandonedLesson(attempt: LessonAttempt): Promise<void> {
  const { studentId, lessonId } = attempt;

  const updated = await prisma.lessonAttempt.update({
    where: { id: attempt.id },
    data: { completedAt: attempt.completedAt ?? new Date(), status: "NEEDS_REVIEW", currentStage: "COMPLETE" },
  });

  await tickTheBoard(attempt.assignmentId, { studentId, lessonId });
  await recomputeLessonProgress(studentId, lessonId);

  // One review item per lesson, not one per abandoned attempt — a revisit that stalls again
  // must not queue a second reminder alongside the first still waiting.
  //
  // Counting SCHEDULED as "already queued" here is only honest because SCHEDULED can no longer
  // mean "stranded" elsewhere: `requeueAbandonedReviews` puts a stale SCHEDULED item straight
  // back to PENDING, and the two other places that used to leave one dangling — deleting a
  // duplicate/surplus review assignment in `trimDayToTimetable`, and `runReviewAssignment`'s own
  // abandoned-quiz case — now do the same. So a SCHEDULED item found here is always still live:
  // on a board somewhere, waiting to be opened, or a moment away from being requeued if it is
  // stale. Nothing here needs to re-check that; it would just be re-deriving what those functions
  // already guarantee.
  const alreadyQueued = await prisma.reviewItem.findFirst({
    where: { studentId, lessonId, reason: "LOW_SCORE", status: { in: ["PENDING", "SCHEDULED"] } },
  });
  if (!alreadyQueued) {
    await prisma.reviewItem.create({
      data: {
        studentId,
        lessonId,
        reason: "LOW_SCORE",
        status: "PENDING",
        dueAt: todayDateOnly(),
        detail: "Started this lesson but never reached the check quiz.",
      },
    });
  }

  await prisma.activityLog.create({
    data: {
      studentId,
      kind: "lesson_completed",
      data: { lessonId, attemptId: updated.id, status: "NEEDS_REVIEW", reason: "abandoned_before_check" },
    },
  });
}

/**
 * Puts a stale review back to PENDING when the child opened it and never answered it.
 *
 * A review's whole content is its CHECK — `runReviewAssignment` forces `currentStage` there the
 * moment it is opened, before any PRACTICE round could exist — so `settleAbandonedLessons`'s
 * "taught and practised" reasoning has nothing to attach to here at all, and reviews are excluded
 * from it outright (see its comment). But a review abandoned after being opened is a real gap all
 * the same, and it needs its own honest answer, because leaving it alone is not neutral: the
 * planner only ever plans a `ReviewItem` with `status: "PENDING"` (see `planWeek`'s
 * `pendingReviews` query), and the item was flipped to SCHEDULED the moment it was placed on a
 * board. An abandoned, SCHEDULED item that is never put back is not "still there" — its board slot
 * is a past day nobody replans, so it is invisible and permanently unresolved: the exact opposite
 * of a review's purpose, which is to bring back material the child got wrong. A lesson merely
 * *reappearing* too often is a visible nuisance; a review silently vanishing is a hidden one, and
 * worse.
 *
 * The obligation lives in the `ReviewItem`, not the `LessonAttempt` or the `DailyAssignment` — the
 * item is what `completeReview` actually discharges, and only that function should ever move it
 * to DONE. So this only ever moves SCHEDULED back to PENDING: the assignment is left exactly as
 * it is (in particular, never ticked COMPLETED — the review was not done), and the attempt is left
 * exactly as it is too. Whatever partial CHECK answers the child left in that attempt are still
 * there for `startOrResumeAttempt` to hand back once the requeued item is opened again; a review
 * genuinely lost twice over would be an attempt reset on top of an item lost, and there is no need
 * to reset anything here to fix the one thing that was actually broken.
 */
export async function requeueAbandonedReviews(studentId: string): Promise<number> {
  const cutoff = abandonedSince();

  const stale = await prisma.dailyAssignment.findMany({
    where: {
      studentId,
      kind: "REVIEW",
      status: { in: ["PLANNED", "IN_PROGRESS"] },
      updatedAt: { lt: cutoff },
      reviewItemId: { not: null },
      reviewItem: { status: "SCHEDULED" },
    },
    select: { reviewItemId: true },
  });

  let requeued = 0;
  for (const { reviewItemId } of stale) {
    // `updateMany` with the status still in the `where` guards against two settle passes (one
    // from `ensureDayPlanned`, one from `planWeek`) both trying to requeue the same item.
    const result = await prisma.reviewItem
      .updateMany({ where: { id: reviewItemId!, status: "SCHEDULED" }, data: { status: "PENDING" } })
      .catch(() => ({ count: 0 }));
    if (result.count > 0) requeued += 1;
  }
  return requeued;
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

/**
 * How long this child has been in this subject's period today.
 *
 * A period is forty-five minutes of a subject, not of a lesson. When a child finishes a topic
 * with twenty minutes left they carry straight on into the next one, and the clock has to carry
 * on with them — otherwise starting a second topic hands them a fresh forty-five minutes and
 * the school day never ends.
 *
 * Summed on the server from the attempts themselves, across every lesson of that subject today.
 * The timetable allows one subject per day, so "this subject, today" and "this period" are the
 * same stretch of time. It cannot be edited from the page, which matters: the number decides
 * when they are allowed to stop.
 */
export async function periodSecondsSpent(studentId: string, subjectId: string, dayStart: Date): Promise<number> {
  const attempts = await prisma.lessonAttempt.findMany({
    where: {
      studentId,
      startedAt: { gte: dayStart },
      lesson: { unit: { programme: { subjectId } } },
    },
    select: { timeSpentSeconds: true },
  });
  return attempts.reduce((sum, a) => sum + a.timeSpentSeconds, 0);
}
