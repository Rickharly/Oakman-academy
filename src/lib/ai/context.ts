/**
 * Context composition for the AI teacher (spec §18-23, §49-53). Context is composed,
 * not dumped: the current lesson/activity, a relevant transcript window, active
 * learning observations for the subject, and a short recent-message window — never
 * the whole transcript or the whole chat history.
 */
import { prisma } from "@/lib/db";
import type {
  AiLearningObservation,
  LessonStage,
  Question,
  QuestionAttempt,
  TeacherMode,
} from "@/generated/prisma/client";

/** Stage -> teacher mode (ARCHITECTURE §4). Server-computed; the model never chooses
 * its own mode. Exported (and re-exported) from `teacher-agent.ts` per the module
 * contract; it lives here to avoid a circular import between the two files. */
export function teacherModeForStage(stage: LessonStage | null | undefined): TeacherMode {
  switch (stage) {
    case "STARTER":
      return "PRACTICE";
    case "LEARN":
      return "LEARN";
    case "PRACTICE":
      return "PRACTICE";
    case "CHECK":
      return "ASSESSMENT";
    case "FEEDBACK":
    case "COMPLETE":
      return "LEARN";
    default:
      // No active attempt (e.g. the standalone /teacher chat) -> LEARN.
      return "LEARN";
  }
}

export interface ComposeContextInput {
  studentId: string;
  lessonAttemptId?: string;
  questionId?: string;
  message: string;
}

export interface TeacherContext {
  studentId: string;
  studentName: string;
  yearGroup: number;
  mode: TeacherMode;
  subject: { id: string; title: string } | null;
  unit: { id: string; title: string } | null;
  lesson: {
    id: string;
    title: string;
    keyLearningPoints: string[];
    keywords: { keyword: string; description: string }[];
    misconceptions: { misconception: string; response: string }[];
    transcript: string | null;
  } | null;
  lessonAttemptId: string | null;
  currentStage: LessonStage | null;
  question: { id: string; prompt: string } | null;
  studentAnswer: unknown | null;
  observations: AiLearningObservation[];
  transcriptWindow: string | null;
}

export interface ComposedContext {
  context: TeacherContext;
  /** The STUDENT/SUBJECT/UNIT/LESSON/OBJECTIVES/CURRENT ACTIVITY/STUDENT
   * ANSWER/MISCONCEPTIONS/RECENT DIFFICULTIES block (spec §19), ready to embed in the
   * system prompt via `buildSystemPrompt`. */
  text: string;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asKeywords(value: unknown): { keyword: string; description: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is { keyword?: unknown; description?: unknown } => typeof v === "object" && v !== null)
    .map((v) => ({ keyword: String(v.keyword ?? ""), description: String(v.description ?? "") }))
    .filter((k) => k.keyword);
}

function asMisconceptions(value: unknown): { misconception: string; response: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is { misconception?: unknown; response?: unknown } => typeof v === "object" && v !== null)
    .map((v) => ({ misconception: String(v.misconception ?? ""), response: String(v.response ?? "") }))
    .filter((m) => m.misconception);
}

// ---------- transcript windowing ----------

const CHUNK_TARGET_CHARS = 300;
const WINDOW_MAX_CHARS = 1500;
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "to", "and", "in", "on", "for",
  "it", "that", "this", "with", "as", "at", "by", "be", "or", "so", "than", "then",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

function overlapScore(query: Set<string>, chunk: Set<string>): number {
  let score = 0;
  for (const word of query) if (chunk.has(word)) score++;
  return score;
}

/** Splits transcript text into ~300-char chunks, breaking on word boundaries. */
export function chunkTranscript(transcript: string, targetSize = CHUNK_TARGET_CHARS): string[] {
  const words = transcript.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > targetSize && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Picks the best-matching ~300-char chunk (± 1 neighbour, ≤ 1500 chars) by lexical
 * overlap with the query text. Returns null when there's no transcript, or nothing
 * in it lexically overlaps the query (nothing relevant is worth the tokens). */
export function selectTranscriptWindow(transcript: string | null | undefined, query: string): string | null {
  if (!transcript || !transcript.trim()) return null;
  const chunks = chunkTranscript(transcript);
  if (chunks.length === 0) return null;

  const queryWords = tokenize(query);
  if (queryWords.size === 0) return null;

  let bestIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < chunks.length; i++) {
    const score = overlapScore(queryWords, tokenize(chunks[i]));
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  if (bestIndex === -1 || bestScore === 0) return null;

  const start = Math.max(0, bestIndex - 1);
  const end = Math.min(chunks.length - 1, bestIndex + 1);
  const window = chunks.slice(start, end + 1).join(" ");
  return window.length > WINDOW_MAX_CHARS ? window.slice(0, WINDOW_MAX_CHARS) : window;
}

// ---------- context composition ----------

export async function composeContext(input: ComposeContextInput): Promise<ComposedContext> {
  const student = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: input.studentId },
    include: { user: true },
  });

  let lessonAttempt:
    | (import("@/generated/prisma/client").LessonAttempt & {
        lesson: import("@/generated/prisma/client").Lesson & {
          unit: import("@/generated/prisma/client").Unit & {
            programme: import("@/generated/prisma/client").Programme & { subject: import("@/generated/prisma/client").Subject };
          };
        };
      })
    | null = null;

  if (input.lessonAttemptId) {
    lessonAttempt = await prisma.lessonAttempt.findUnique({
      where: { id: input.lessonAttemptId },
      include: { lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } } },
    });
  }

  const lesson = lessonAttempt?.lesson ?? null;
  const unit = lesson?.unit ?? null;
  const subject = unit?.programme.subject ?? null;
  const mode = teacherModeForStage(lessonAttempt?.currentStage ?? null);

  let question: Question | null = null;
  if (input.questionId) {
    question = await prisma.question.findUnique({ where: { id: input.questionId } });
  }

  let latestAttempt: QuestionAttempt | null = null;
  if (question) {
    latestAttempt = await prisma.questionAttempt.findFirst({
      where: { studentId: input.studentId, questionId: question.id },
      orderBy: { submittedAt: "desc" },
    });
  }

  const observations = subject
    ? await prisma.aiLearningObservation.findMany({
        where: { studentId: input.studentId, active: true, subjectId: subject.id },
        orderBy: { lastSeenAt: "desc" },
        take: 10,
      })
    : [];

  const transcriptQuery = [input.message, question?.prompt ?? ""].filter(Boolean).join(" ");
  const transcriptWindow = selectTranscriptWindow(lesson?.transcript ?? null, transcriptQuery);

  const context: TeacherContext = {
    studentId: input.studentId,
    studentName: student.user.displayName,
    yearGroup: student.yearGroup,
    mode,
    subject: subject ? { id: subject.id, title: subject.title } : null,
    unit: unit ? { id: unit.id, title: unit.title } : null,
    lesson: lesson
      ? {
          id: lesson.id,
          title: lesson.title,
          keyLearningPoints: asStringArray(lesson.keyLearningPoints),
          keywords: asKeywords(lesson.keywords),
          misconceptions: asMisconceptions(lesson.misconceptions),
          transcript: lesson.transcript,
        }
      : null,
    lessonAttemptId: lessonAttempt?.id ?? null,
    currentStage: lessonAttempt?.currentStage ?? null,
    question: question ? { id: question.id, prompt: question.prompt } : null,
    studentAnswer: latestAttempt?.response ?? null,
    observations,
    transcriptWindow,
  };

  return { context, text: renderContextText(context) };
}

function renderContextText(ctx: TeacherContext): string {
  const lines: string[] = [];
  lines.push(`STUDENT: ${ctx.studentName}, Year ${ctx.yearGroup}`);
  lines.push(`SUBJECT: ${ctx.subject?.title ?? "(no subject — general chat)"}`);
  lines.push(`UNIT: ${ctx.unit?.title ?? "(none)"}`);
  lines.push(`LESSON: ${ctx.lesson?.title ?? "(no lesson in progress)"}`);
  lines.push(
    `OBJECTIVES: ${ctx.lesson && ctx.lesson.keyLearningPoints.length > 0 ? ctx.lesson.keyLearningPoints.join("; ") : "(none noted)"}`,
  );

  const activity = ctx.currentStage
    ? `Stage ${ctx.currentStage}${ctx.question ? ` — question: "${ctx.question.prompt}"` : ""}`
    : "No active lesson stage.";
  lines.push(`CURRENT ACTIVITY: ${activity}`);
  lines.push(
    `STUDENT ANSWER: ${ctx.studentAnswer !== null && ctx.studentAnswer !== undefined ? JSON.stringify(ctx.studentAnswer) : "(no answer given yet)"}`,
  );
  lines.push(
    `MISCONCEPTIONS: ${
      ctx.lesson && ctx.lesson.misconceptions.length > 0
        ? ctx.lesson.misconceptions.map((m) => m.misconception).join("; ")
        : "(none noted)"
    }`,
  );
  lines.push(
    `RECENT DIFFICULTIES: ${
      ctx.observations.length > 0
        ? ctx.observations.map((o) => `${o.topic} (${o.kind.toLowerCase()})`).join("; ")
        : "(none noted)"
    }`,
  );
  if (ctx.transcriptWindow) {
    lines.push(`RELEVANT TRANSCRIPT EXCERPT: "${ctx.transcriptWindow}"`);
  }
  return lines.join("\n");
}
