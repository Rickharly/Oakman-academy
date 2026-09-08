/**
 * Function tools offered to the AI teacher during `stream()` (ARCHITECTURE §6).
 * Every tool is built server-side around a fixed `ToolContext` — the model can never
 * supply `studentId` (or which subject/lesson it's scoped to); it only ever sends the
 * small, tool-specific arguments declared in each zod schema below.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { addDaysKey, schoolDayKey, schoolDayStart } from "@/lib/dates";
import type { TeacherMode } from "@/generated/prisma/client";
import type { ToolDefinition } from "./provider";
import { selectTranscriptWindow } from "./context";

export interface ToolContext {
  studentId: string;
  mode: TeacherMode;
  lessonId: string | null;
  subjectId: string | null;
  questionId: string | null;
}

const getLessonTranscriptParams = z.object({
  /** When given, returns a relevant window around this query instead of the full transcript. */
  query: z.string().optional(),
});

const getQuestionParams = z.object({
  /** Defaults to the question currently in context when omitted. */
  questionId: z.string().optional(),
});

const getRecentErrorsParams = z.object({});

const saveLearningObservationParams = z.object({
  topic: z.string().min(1),
  kind: z.enum(["STRENGTH", "DEVELOPING", "MISCONCEPTION", "NOTE"]),
  detail: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

const createReviewTaskParams = z.object({
  detail: z.string().min(1),
});

function getLessonTranscript(ctx: ToolContext): ToolDefinition {
  return {
    name: "getLessonTranscript",
    description:
      "Get the lesson video transcript — either the full transcript, or (pass `query`) just the window most relevant to a topic or phrase.",
    parameters: getLessonTranscriptParams,
    async execute(rawArgs) {
      const args = getLessonTranscriptParams.parse(rawArgs);
      if (!ctx.lessonId) return { error: "No lesson in context." };
      const lesson = await prisma.lesson.findUnique({ where: { id: ctx.lessonId }, select: { transcript: true } });
      if (!lesson?.transcript) return { error: "No transcript available for this lesson." };
      if (args.query) {
        const window = selectTranscriptWindow(lesson.transcript, args.query);
        return { transcript: window ?? lesson.transcript.slice(0, 1500) };
      }
      return { transcript: lesson.transcript };
    },
  };
}

function getQuestion(ctx: ToolContext): ToolDefinition {
  return {
    name: "getQuestion",
    description:
      "Get a question's prompt and options (never the answer key while the student is being assessed). Defaults to the question currently in context.",
    parameters: getQuestionParams,
    async execute(rawArgs) {
      const args = getQuestionParams.parse(rawArgs);
      const questionId = args.questionId ?? ctx.questionId;
      if (!questionId) return { error: "No question in context." };
      const question = await prisma.question.findUnique({ where: { id: questionId } });
      if (!question) return { error: "Question not found." };
      if (ctx.lessonId && question.lessonId !== ctx.lessonId) {
        return { error: "That question is not part of the current lesson." };
      }
      const base = {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        options: question.options,
      };
      if (ctx.mode === "ASSESSMENT") return base;

      // Even outside an assessment, the answer key stays on the server until the child has
      // actually submitted an answer. A model that has been handed the answer leaks it — in a
      // hint, in a "not quite", in the shape of the next question it asks. The cheapest way to
      // stop the teacher giving away an answer is to not give her the answer.
      const answered = await prisma.questionAttempt.findFirst({
        where: { studentId: ctx.studentId, questionId: question.id },
        select: { id: true },
      });
      if (!answered) return { ...base, note: "Not answered yet — the answer key is withheld." };

      return { ...base, answerKey: question.answerKey, explanation: question.explanation };
    },
  };
}

function getRecentErrors(ctx: ToolContext): ToolDefinition {
  return {
    name: "getRecentErrors",
    description: "Get the student's last 10 incorrect answers in this subject, to spot patterns.",
    parameters: getRecentErrorsParams,
    async execute() {
      if (!ctx.subjectId) return { errors: [] };
      const attempts = await prisma.questionAttempt.findMany({
        where: {
          studentId: ctx.studentId,
          isCorrect: false,
          question: { lesson: { unit: { programme: { subjectId: ctx.subjectId } } } },
        },
        orderBy: { submittedAt: "desc" },
        take: 10,
        include: { question: { select: { prompt: true, type: true } } },
      });
      return {
        errors: attempts.map((a) => ({
          questionPrompt: a.question.prompt,
          questionType: a.question.type,
          feedback: a.feedback,
          misconceptions: a.misconceptions,
          submittedAt: a.submittedAt.toISOString(),
        })),
      };
    },
  };
}

function saveLearningObservation(ctx: ToolContext): ToolDefinition {
  return {
    name: "saveLearningObservation",
    description:
      "Record (or update) a structured note about this student's strengths, developing skills, misconceptions, or a general note — separate from chat history.",
    parameters: saveLearningObservationParams,
    async execute(rawArgs) {
      const args = saveLearningObservationParams.parse(rawArgs);
      const existing = await prisma.aiLearningObservation.findFirst({
        where: { studentId: ctx.studentId, topic: args.topic, kind: args.kind },
      });
      if (existing) {
        const updated = await prisma.aiLearningObservation.update({
          where: { id: existing.id },
          data: {
            detail: args.detail,
            confidence: args.confidence ?? existing.confidence,
            occurrences: { increment: 1 },
            lastSeenAt: new Date(),
            active: true,
          },
        });
        return { id: updated.id, occurrences: updated.occurrences, created: false };
      }
      const created = await prisma.aiLearningObservation.create({
        data: {
          studentId: ctx.studentId,
          subjectId: ctx.subjectId ?? undefined,
          lessonId: ctx.lessonId ?? undefined,
          kind: args.kind,
          topic: args.topic,
          detail: args.detail,
          confidence: args.confidence ?? 0.5,
          source: "AI",
        },
      });
      return { id: created.id, occurrences: created.occurrences, created: true };
    },
  };
}

function createReviewTask(ctx: ToolContext): ToolDefinition {
  return {
    name: "createReviewTask",
    description: "Flag a misconception for spaced review, due tomorrow.",
    parameters: createReviewTaskParams,
    async execute(rawArgs) {
      const args = createReviewTaskParams.parse(rawArgs);
      if (!ctx.lessonId) return { error: "No lesson in context to attach the review task to." };
      const dueAt = schoolDayStart(addDaysKey(schoolDayKey(), 1));
      const created = await prisma.reviewItem.create({
        data: {
          studentId: ctx.studentId,
          lessonId: ctx.lessonId,
          questionId: ctx.questionId ?? undefined,
          reason: "MISCONCEPTION",
          detail: args.detail,
          dueAt,
        },
      });
      return { id: created.id, dueAt: created.dueAt.toISOString() };
    },
  };
}

export function buildTeacherTools(ctx: ToolContext): ToolDefinition[] {
  return [
    getLessonTranscript(ctx),
    getQuestion(ctx),
    getRecentErrors(ctx),
    saveLearningObservation(ctx),
    createReviewTask(ctx),
  ];
}
