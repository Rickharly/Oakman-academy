/**
 * Lesson inspection query (spec §34, §36; ARCHITECTURE §8; docs/CONTRACTS.md). Assembles
 * everything the admin lesson-inspection page (the most important admin screen) needs into
 * one well-typed object: every attempt newest-first, every activity, every question with its
 * full answer key (the parent may see everything a student cannot), every historical attempt
 * at that question, the effective grade after overrides, the overrides themselves, and the AI
 * conversations tied to those attempts.
 */
import { prisma } from "@/lib/db";
import type {
  ActivityAttempt,
  AiConversation,
  Lesson,
  LessonAttempt,
  ParentOverride,
  Programme,
  Question,
  QuestionAttempt,
  StudentLessonProgress,
  Subject,
  TeacherFeedback,
  Unit,
} from "@/generated/prisma/client";
import { ApiError } from "@/lib/auth/api";
import { effectiveGrade, type EffectiveGrade } from "./overrides";

export interface InspectionQuestionAttempt extends QuestionAttempt {
  effective: EffectiveGrade;
  overrides: ParentOverride[];
}

export interface InspectionQuestion {
  question: Question;
  /** Every attempt at this question within this activity, newest first. */
  attempts: InspectionQuestionAttempt[];
  /** `attempts[0]` — the current attempt. */
  latest: InspectionQuestionAttempt | null;
}

export interface InspectionActivity {
  activity: ActivityAttempt;
  questions: InspectionQuestion[];
}

export interface InspectionAttempt {
  attempt: LessonAttempt;
  activities: InspectionActivity[];
  conversations: (AiConversation & { messageCount: number })[];
  feedback: TeacherFeedback[];
}

export interface LessonInspection {
  lesson: Lesson & { unit: Unit & { programme: Programme & { subject: Subject } } };
  progress: StudentLessonProgress | null;
  attempts: InspectionAttempt[];
  overrides: ParentOverride[];
}

export async function getLessonInspection(studentId: string, lessonId: string): Promise<LessonInspection> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: { include: { programme: { include: { subject: true } } } } },
  });
  if (!lesson) throw new ApiError(404, "Lesson not found");

  const progress = await prisma.studentLessonProgress.findUnique({
    where: { studentId_lessonId: { studentId, lessonId } },
  });

  const lessonAttempts = await prisma.lessonAttempt.findMany({
    where: { studentId, lessonId },
    orderBy: { attemptNumber: "desc" },
  });
  const lessonAttemptIds = lessonAttempts.map((a) => a.id);

  const activityAttempts = lessonAttemptIds.length
    ? await prisma.activityAttempt.findMany({
        where: { lessonAttemptId: { in: lessonAttemptIds } },
        orderBy: [{ startedAt: "asc" }, { attemptNumber: "asc" }],
      })
    : [];
  const activityIds = activityAttempts.map((a) => a.id);

  const questionAttempts = activityIds.length
    ? await prisma.questionAttempt.findMany({
        where: { activityAttemptId: { in: activityIds } },
        include: { question: true },
        orderBy: { attemptNumber: "desc" },
      })
    : [];
  const questionAttemptIds = questionAttempts.map((qa) => qa.id);

  const overrides = await prisma.parentOverride.findMany({
    where: {
      studentId,
      OR: [
        { lessonId },
        lessonAttemptIds.length ? { lessonAttemptId: { in: lessonAttemptIds } } : undefined,
        questionAttemptIds.length ? { questionAttemptId: { in: questionAttemptIds } } : undefined,
      ].filter((x): x is NonNullable<typeof x> => x !== undefined),
    },
    orderBy: { createdAt: "desc" },
  });

  const conversations = lessonAttemptIds.length
    ? await prisma.aiConversation.findMany({
        where: { lessonAttemptId: { in: lessonAttemptIds } },
        include: { _count: { select: { messages: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const feedback = lessonAttemptIds.length
    ? await prisma.teacherFeedback.findMany({
        where: { lessonAttemptId: { in: lessonAttemptIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const attempts: InspectionAttempt[] = lessonAttempts.map((attempt) => {
    const activities = activityAttempts
      .filter((a) => a.lessonAttemptId === attempt.id)
      .map((activity): InspectionActivity => {
        const forActivity = questionAttempts.filter((qa) => qa.activityAttemptId === activity.id);
        const byQuestion = new Map<string, typeof forActivity>();
        for (const qa of forActivity) {
          const list = byQuestion.get(qa.questionId) ?? [];
          list.push(qa);
          byQuestion.set(qa.questionId, list);
        }
        const questions: InspectionQuestion[] = [...byQuestion.entries()]
          .sort((a, b) => a[1][0].question.order - b[1][0].question.order)
          .map(([, qaList]) => {
            const attemptsForQuestion: InspectionQuestionAttempt[] = qaList.map((qa) => ({
              ...qa,
              effective: effectiveGrade(qa, overrides),
              overrides: overrides.filter((o) => o.questionAttemptId === qa.id),
            }));
            return { question: qaList[0].question, attempts: attemptsForQuestion, latest: attemptsForQuestion[0] ?? null };
          });
        return { activity, questions };
      });

    return {
      attempt,
      activities,
      conversations: conversations
        .filter((c) => c.lessonAttemptId === attempt.id)
        .map((c) => ({ ...c, messageCount: c._count.messages })),
      feedback: feedback.filter((f) => f.lessonAttemptId === attempt.id),
    };
  });

  return { lesson, progress, attempts, overrides };
}
