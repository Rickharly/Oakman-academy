/**
 * The AI teacher (spec §16-23, §49-53; ARCHITECTURE §6).
 *
 * One service, several capabilities. Everything that software depends on (grades, summaries,
 * generated practice, observations) uses structured outputs validated by zod; only the chat
 * reply is free text. The teacher's mode is always computed on the server from the lesson
 * stage — the client cannot ask for a more permissive one.
 *
 * Every capability except `chat` is written so that an AI failure degrades rather than breaks:
 * callers wrap them, and `grade()` is the one place that must throw, because silently marking
 * a child's work correct would be worse than an error.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import type {
  AiLearningObservation,
  LessonStage,
  Question,
  QuestionAttempt,
  TeacherMode,
} from "@/generated/prisma/client";
import { gradeResultSchema, type GradeResult } from "@/lib/questions/types";
import type { GradingContext } from "@/lib/grading/grade";
import { schoolDayEnd, schoolDayStart } from "@/lib/dates";
import { getAiProvider, AiError, type AiProvider, type ChatMessage } from "./provider";
import { buildSystemPrompt } from "./prompts";
import { composeContext, teacherModeForStage, type TeacherView } from "./context";
import { buildTeacherTools } from "./tools";

export { teacherModeForStage };

export interface ChatInput {
  studentId: string;
  message: string;
  conversationId?: string;
  lessonAttemptId?: string;
  questionId?: string;
  /** What the player says is on screen. Display information only — it can make the teacher
   * stricter, never more permissive. */
  view?: TeacherView;
}

export interface ChatResult {
  conversationId: string;
  stream: AsyncIterable<string>;
}

/** Messages kept verbatim in the prompt; older turns are folded into the rolling summary. */
const RECENT_MESSAGE_WINDOW = 8;
/** Above this many stored messages, the conversation gets summarised to keep prompts small. */
const SUMMARISE_AFTER = 20;

function describeResponse(response: unknown): string {
  if (response === null || response === undefined) return "(no answer given)";
  if (typeof response === "string") return response;
  if (typeof response === "object") {
    const r = response as Record<string, unknown>;
    if (typeof r.text === "string") return r.text;
    if (typeof r.value === "boolean") return r.value ? "True" : "False";
    if (typeof r.optionId === "string") return `Chose option ${r.optionId}`;
    if (Array.isArray(r.optionIds)) return `Chose options ${r.optionIds.join(", ")}`;
    if (Array.isArray(r.order)) return `Order: ${r.order.join(" → ")}`;
    if (Array.isArray(r.pairs)) {
      return `Pairs: ${(r.pairs as { leftId?: string; rightId?: string }[])
        .map((p) => `${p.leftId}→${p.rightId}`)
        .join(", ")}`;
    }
  }
  return JSON.stringify(response);
}

function describeAnswerKey(question: Pick<Question, "answerKey" | "type">): string {
  const key = question.answerKey as Record<string, unknown> | null;
  if (!key) return "(no model answer recorded)";
  if (typeof key.modelAnswer === "string" && key.modelAnswer) return key.modelAnswer;
  if (Array.isArray(key.accepted) && key.accepted.length) return (key.accepted as string[]).join(" / ");
  if (Array.isArray(key.keyPoints) && key.keyPoints.length) {
    return `Should include: ${(key.keyPoints as string[]).join("; ")}`;
  }
  return JSON.stringify(key);
}

// ───────────────────────────── chat ─────────────────────────────

/**
 * Streams a tutor reply and persists both sides of the exchange.
 *
 * The returned stream is consumed by the route handler; the assistant message is written
 * once the stream completes, so an abandoned request never stores a half-sentence.
 */
async function chat(input: ChatInput): Promise<ChatResult> {
  const ai = getAiProvider();
  const composed = await composeContext({
    studentId: input.studentId,
    lessonAttemptId: input.lessonAttemptId,
    questionId: input.questionId,
    message: input.message,
    view: input.view,
  });
  const ctx = composed.context;

  // Load or create the conversation, always scoped to this student.
  let conversation = input.conversationId
    ? await prisma.aiConversation.findFirst({
        where: { id: input.conversationId, studentId: input.studentId },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.aiConversation.create({
      data: {
        studentId: input.studentId,
        lessonId: ctx.lesson?.id ?? null,
        lessonAttemptId: ctx.lessonAttemptId,
        mode: ctx.mode,
        title: ctx.lesson?.title ?? "Teacher",
      },
    });
  } else if (conversation.mode !== ctx.mode) {
    // The stage moved on since the last message; the mode follows it.
    conversation = await prisma.aiConversation.update({
      where: { id: conversation.id },
      data: { mode: ctx.mode },
    });
  }

  const history = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: RECENT_MESSAGE_WINDOW,
  });
  history.reverse();

  await prisma.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: input.message,
      contextSnapshot: {
        mode: ctx.mode,
        stage: ctx.currentStage,
        lessonId: ctx.lesson?.id ?? null,
        questionId: ctx.question?.id ?? null,
      },
    },
  });

  const system = buildSystemPrompt({
    studentName: ctx.studentName,
    yearGroup: ctx.yearGroup,
    age: ctx.age,
    mode: ctx.mode,
    contextText: composed.text,
  });

  const messages: ChatMessage[] = [];
  if (conversation.summary) {
    messages.push({
      role: "assistant",
      content: `Summary of our conversation so far: ${conversation.summary}`,
    });
  }
  for (const m of history) {
    messages.push({ role: m.role === "USER" ? "user" : "assistant", content: m.content });
  }
  messages.push({ role: "user", content: input.message });

  const tools = buildTeacherTools({
    studentId: input.studentId,
    mode: ctx.mode,
    lessonId: ctx.lesson?.id ?? null,
    subjectId: ctx.subject?.id ?? null,
    questionId: ctx.question?.id ?? null,
  });

  const conversationId = conversation.id;

  async function* run(): AsyncIterable<string> {
    let text = "";
    const toolCalls: { name: string; args: unknown; result: unknown }[] = [];
    let model: string | undefined;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;

    try {
      for await (const event of ai.stream({ model: "fast", system, messages, tools })) {
        if (event.type === "text") {
          text += event.text;
          yield event.text;
        } else if (event.type === "tool_call") {
          toolCalls.push({ name: event.name, args: event.args, result: event.result });
        } else {
          model = event.model;
          tokensIn = event.tokensIn;
          tokensOut = event.tokensOut;
        }
      }
    } finally {
      if (text.trim()) {
        await prisma.aiMessage.create({
          data: {
            conversationId,
            role: "ASSISTANT",
            content: text,
            toolCalls: toolCalls.length ? (toolCalls as object[]) : undefined,
            model,
            tokensIn,
            tokensOut,
          },
        });
        await maybeSummarise(conversationId, ai);
      }
    }
  }

  return { conversationId, stream: run() };
}

const summarySchema = z.object({ summary: z.string() });

/**
 * Folds a long conversation into a short summary so later prompts stay cheap (spec §53).
 * Best-effort: a failure here costs nothing but a slightly larger next prompt.
 */
async function maybeSummarise(conversationId: string, ai: AiProvider): Promise<void> {
  try {
    const count = await prisma.aiMessage.count({ where: { conversationId } });
    if (count <= SUMMARISE_AFTER) return;

    const messages = await prisma.aiMessage.findMany({
      where: { conversationId, role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { createdAt: "asc" },
    });

    const transcript = messages
      .map((m) => `${m.role === "USER" ? "Student" : "Teacher"}: ${m.content}`)
      .join("\n");

    const { data } = await ai.structured({
      model: "fast",
      schemaName: "conversationSummary",
      schema: summarySchema,
      system:
        "Summarise this tutoring conversation in under 120 words. Keep what the student " +
        "understood, what they struggled with, and any explanation the teacher already gave, " +
        "so the teacher can continue without re-reading it.",
      messages: [{ role: "user", content: transcript }],
    });

    await prisma.aiConversation.update({
      where: { id: conversationId },
      data: { summary: data.summary },
    });
  } catch {
    // Summarising is an optimisation, never a requirement.
  }
}

// ───────────────────────────── grading ─────────────────────────────

/**
 * Marks one written answer. Used only for question types deterministic grading cannot judge
 * (extended writing, and short answers that did not match the accepted list).
 *
 * The strong model is used for extended writing, where partial credit and reasoning matter;
 * everything else uses the fast model.
 */
async function grade(args: {
  question: Question;
  response: unknown;
  ctx: GradingContext;
}): Promise<GradeResult & { raw: unknown; model: string }> {
  const { question, response, ctx } = args;
  const ai = ctx.ai ?? getAiProvider();
  const useStrong = question.type === "EXTENDED_TEXT";

  const rubric = question.rubric ?? (question.answerKey as { rubric?: string } | null)?.rubric;

  const system = [
    `You are marking one answer written by a ${ctx.studentYearGroup === 5 ? "9 to 10" : "11 to 12"} year old`,
    `(Year ${ctx.studentYearGroup}) child in the lesson "${ctx.lesson.title}".`,
    "",
    "Mark fairly and generously on substance, not on spelling, punctuation or handwriting-style",
    "slips, unless the question is explicitly about those. A child who shows the right idea in",
    "their own words is correct. Award partial credit where part of the thinking is sound.",
    "",
    "Return:",
    "- score: 0 to maxScore, whole or half marks",
    "- correct: true only when the answer would be fully accepted",
    "- mastery: 0 to 1, how well this answer shows they understand the idea",
    "- feedbackForStudent: speak TO the child, warmly and specifically. Say what they got right",
    "  first. If it is wrong, point them at what to look at again — never state the answer.",
    "  Two or three sentences, plain UK English.",
    "- reasoningForParent: one or two sentences explaining your mark, for the parent's records.",
    "- misconceptions: the specific misunderstanding shown, if any, as short phrases. Empty if none.",
    "- needsReview: true when this should come back in the review queue.",
    "",
    ctx.lesson.keyLearningPoints.length
      ? `What this lesson teaches:\n${ctx.lesson.keyLearningPoints.map((p) => `- ${p}`).join("\n")}`
      : "",
    ctx.lesson.misconceptions.length
      ? `Known misconceptions for this lesson:\n${ctx.lesson.misconceptions
          .map((m) => `- ${m.misconception} (teacher's response: ${m.response})`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userContent = [
    `Question: ${question.prompt}`,
    `Maximum score: ${question.maxScore}`,
    `Expected answer: ${describeAnswerKey(question)}`,
    rubric ? `Marking guidance: ${rubric}` : "",
    "",
    `The child answered: ${describeResponse(response)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { data, model } = await ai.structured({
    model: useStrong ? "strong" : "fast",
    schemaName: "grade",
    schema: gradeResultSchema,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  // The model is advisory on the numbers; the server owns the bounds.
  const maxScore = question.maxScore;
  const score = Math.max(0, Math.min(maxScore, data.score));
  const mastery = Math.max(0, Math.min(1, data.mastery));

  return {
    ...data,
    score,
    maxScore,
    mastery,
    correct: data.correct && score >= maxScore,
    raw: data,
    model,
  };
}

// ───────────────────────────── summaries ─────────────────────────────

const lessonSummarySchema = z.object({
  forStudent: z.string(),
  forParent: z.string(),
  misconceptions: z.array(z.string()),
});

/**
 * End-of-lesson feedback (spec §17). Writes the parent-facing note as `TeacherFeedback` and
 * stores the child-facing text on the attempt so the Feedback stage can show it.
 */
async function summarizeLesson(
  lessonAttemptId: string,
): Promise<{ forStudent: string; forParent: string; misconceptions: string[] }> {
  const attempt = await prisma.lessonAttempt.findUnique({
    where: { id: lessonAttemptId },
    include: {
      lesson: true,
      student: { include: { user: true } },
      activities: { include: { questionAttempts: { include: { question: true } } } },
    },
  });
  if (!attempt) throw new AiError(`Lesson attempt ${lessonAttemptId} not found`);

  const graded = attempt.activities
    .flatMap((a) => a.questionAttempts)
    .filter((qa) => qa.gradedBy !== "PENDING");

  const lines = graded.map((qa) => {
    const verdict = qa.isCorrect ? "correct" : "incorrect";
    return `- ${qa.question.prompt}\n  answered: ${describeResponse(qa.response)} (${verdict}, ${qa.score ?? 0}/${qa.maxScore})`;
  });

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "fast",
    schemaName: "lessonSummary",
    schema: lessonSummarySchema,
    system: [
      `Write the end-of-lesson feedback for ${attempt.student.user.displayName}, a Year`,
      `${attempt.student.yearGroup} child who has just finished "${attempt.lesson.title}".`,
      "",
      "forStudent: speak to the child. Name one specific thing they did well, then one thing to",
      "work on, then a sentence of encouragement. Warm, plain UK English, under 60 words.",
      "forParent: a factual note for the parent's records on what was understood and what was not.",
      "misconceptions: short phrases naming any specific misunderstanding shown. Empty if none.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: lines.length
          ? `Their answers:\n${lines.join("\n")}`
          : "They completed the lesson without answering any marked questions.",
      },
    ],
  });

  await prisma.lessonAttempt.update({
    where: { id: lessonAttemptId },
    data: { feedbackSummary: data.forStudent },
  });

  await prisma.teacherFeedback.create({
    data: {
      studentId: attempt.studentId,
      lessonAttemptId,
      authorType: "AI",
      content: data.forParent,
      visibleToStudent: false,
    },
  });

  return data;
}

const daySummarySchema = z.object({
  content: z.string(),
  recommendation: z.string().optional(),
});

/** The parent's end-of-day note (spec §38). Never shown to the child. */
async function summarizeDay(studentId: string, dateKey: string): Promise<{ content: string; data: unknown }> {
  const from = schoolDayStart(dateKey);
  const to = schoolDayEnd(dateKey);

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) throw new AiError(`Student ${studentId} not found`);

  const attempts = await prisma.lessonAttempt.findMany({
    where: { studentId, startedAt: { gte: from, lt: to } },
    include: { lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } } },
    orderBy: { startedAt: "asc" },
  });

  const stats = {
    lessonsStarted: attempts.length,
    lessonsCompleted: attempts.filter((a) => a.completedAt).length,
    minutes: Math.round(attempts.reduce((n, a) => n + a.timeSpentSeconds, 0) / 60),
    averageScore: (() => {
      const scored = attempts.filter((a) => a.score !== null && a.maxScore);
      if (!scored.length) return null;
      const pct = scored.map((a) => (a.score! / a.maxScore!) * 100);
      return Math.round(pct.reduce((x, y) => x + y, 0) / pct.length);
    })(),
  };

  const lines = attempts.map(
    (a) =>
      `- ${a.lesson.unit.programme.subject.title}: "${a.lesson.title}" — ` +
      `${a.completedAt ? "completed" : "not finished"}` +
      (a.score !== null && a.maxScore ? `, ${Math.round((a.score / a.maxScore) * 100)}%` : "") +
      (a.masteryScore !== null ? `, mastery ${Math.round(a.masteryScore * 100)}%` : ""),
  );

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "strong",
    schemaName: "daySummary",
    schema: daySummarySchema,
    system: [
      `Write a short end-of-day note for the parent of ${student.user.displayName}, Year ${student.yearGroup}.`,
      "Three or four sentences: what they did, where they were strong, where they needed support,",
      "and one concrete recommendation for tomorrow if one is warranted. Factual and specific.",
      "This is for the parent only — do not address the child.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: lines.length
          ? `Today's lessons:\n${lines.join("\n")}\n\nTotals: ${JSON.stringify(stats)}`
          : "They did no school work today.",
      },
    ],
  });

  const payload = { ...stats, recommendation: data.recommendation ?? null };

  await prisma.dailySummary.upsert({
    where: { studentId_date: { studentId, date: schoolDayStart(dateKey) } },
    create: { studentId, date: schoolDayStart(dateKey), content: data.content, data: payload },
    update: { content: data.content, data: payload },
  });

  return { content: data.content, data: payload };
}

// ───────────────────────────── generated practice ─────────────────────────────

const practiceSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z.enum(["SHORT_ANSWER", "NUMERIC", "MULTIPLE_CHOICE"]),
        prompt: z.string(),
        /** MULTIPLE_CHOICE only: the choices, correct one first. */
        choices: z.array(z.string()).optional(),
        /** SHORT_ANSWER / NUMERIC: every acceptable answer. */
        acceptedAnswers: z.array(z.string()).optional(),
        explanation: z.string(),
      }),
    )
    .min(1),
});

/**
 * Extra practice targeted at one misconception (spec §51). Clearly marked as generated so it is
 * never confused with the official curriculum's own assessment.
 */
async function generatePractice(args: {
  studentId: string;
  lessonId: string;
  misconception: string;
  count?: number;
}): Promise<Question[]> {
  const count = args.count ?? 3;
  const lesson = await prisma.lesson.findUnique({ where: { id: args.lessonId } });
  if (!lesson) throw new AiError(`Lesson ${args.lessonId} not found`);

  const student = await prisma.studentProfile.findUnique({ where: { id: args.studentId } });
  if (!student) throw new AiError(`Student ${args.studentId} not found`);

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "fast",
    schemaName: "practice",
    schema: practiceSchema,
    system: [
      `Write ${count} short practice questions for a Year ${student.yearGroup} child who has this`,
      `specific misunderstanding in the lesson "${lesson.title}": ${args.misconception}`,
      "",
      "Each question must target that misunderstanding directly and be answerable in under a",
      "minute. Use only SHORT_ANSWER, NUMERIC or MULTIPLE_CHOICE. For MULTIPLE_CHOICE give 3 or 4",
      "choices with the correct one first and plausible wrong ones. For SHORT_ANSWER and NUMERIC",
      "list every acceptable answer. Include a one-sentence explanation of the correct answer.",
    ].join("\n"),
    messages: [{ role: "user", content: `Misconception: ${args.misconception}` }],
  });

  return persistGeneratedQuestions(data.questions.slice(0, count), {
    lessonId: args.lessonId,
    studentId: args.studentId,
    context: { misconception: args.misconception, lessonId: args.lessonId },
    baseOrder: 1000,
  });
}

/** Turns the model's questions into stored, gradable `Question` rows. */
async function persistGeneratedQuestions(
  questions: z.infer<typeof practiceSchema>["questions"],
  opts: { lessonId: string; studentId: string; context: object; baseOrder: number },
): Promise<Question[]> {
  const created: Question[] = [];
  const baseOrder = opts.baseOrder;

  for (const [i, q] of questions.entries()) {
    let options: unknown = null;
    let answerKey: unknown;

    if (q.type === "MULTIPLE_CHOICE") {
      const choices = (q.choices ?? []).map((text, idx) => ({
        id: String.fromCharCode(97 + idx),
        text,
      }));
      if (choices.length < 2) continue;
      // The model is told to put the correct choice first; shuffle deterministically so it
      // is not always option a, while keeping which one is correct.
      const correctId = choices[0]!.id;
      const rotated = [...choices.slice(i % choices.length), ...choices.slice(0, i % choices.length)];
      options = { choices: rotated };
      answerKey = { correctOptionId: correctId };
    } else if (q.type === "NUMERIC") {
      const first = q.acceptedAnswers?.[0];
      const value = Number(String(first ?? "").replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(value)) continue;
      answerKey = { value, tolerance: 0, acceptedStrings: q.acceptedAnswers ?? [] };
    } else {
      answerKey = { accepted: q.acceptedAnswers ?? [], caseSensitive: false };
    }

    const question = await prisma.question.create({
      data: {
        lessonId: opts.lessonId,
        source: "AI_GENERATED",
        stage: "PRACTICE",
        order: baseOrder + i,
        type: q.type,
        prompt: q.prompt,
        options: options as object,
        answerKey: answerKey as object,
        explanation: q.explanation,
        maxScore: 1,
        gradingMode: "DETERMINISTIC",
        generatedForStudentId: opts.studentId,
        generationContext: opts.context,
        providerRef: `ai:${opts.studentId}:${Date.now()}:${i}`,
      },
    });
    created.push(question);
  }

  return created;
}

/**
 * Writes practice questions for a lesson that arrived without any.
 *
 * Some Oak lessons ship their practice as a worksheet PDF. Sending a child off to a PDF is the
 * opposite of what this app is for: nothing they write there can be marked, and nobody learns
 * what they got wrong. So the lesson's own content — its learning points, keywords and the
 * misconceptions Oak itself flags — becomes practice they can actually do here.
 *
 * Generated once per lesson and stored, so a child who reloads sees the same questions and the
 * answers can be marked against a stable key.
 */
async function generateLessonPractice(args: {
  studentId: string;
  lessonId: string;
  count?: number;
  /** Questions they got wrong, when this is practice aimed at a specific gap. */
  missedPrompts?: string[];
  /** True when the child finished early and wants harder work on the same topic. */
  extension?: boolean;
}): Promise<Question[]> {
  const count = args.count ?? 5;

  const lesson = await prisma.lesson.findUnique({
    where: { id: args.lessonId },
    include: { unit: { include: { programme: { include: { subject: true } } } } },
  });
  if (!lesson) throw new AiError(`Lesson ${args.lessonId} not found`);

  const student = await prisma.studentProfile.findUnique({ where: { id: args.studentId } });
  if (!student) throw new AiError(`Student ${args.studentId} not found`);

  // Reuse general practice already written for this lesson. Practice aimed at a specific
  // mistake is always written fresh: handing back questions they have already answered
  // would teach nothing.
  const aimed = (args.missedPrompts ?? []).filter((p) => p.trim().length > 0);
  // Extension work is always fresh: a child who has finished the lesson has seen the stored
  // set already, and handing it back is not more work, it is the same work.
  if (aimed.length === 0 && !args.extension) {
    const existing = await prisma.question.findMany({
      where: { lessonId: lesson.id, stage: "PRACTICE", source: "AI_GENERATED" },
      orderBy: { order: "asc" },
    });
    if (existing.length >= count) return existing;
  }

  const asStrings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  const asPairs = (value: unknown, a: string, b: string): string[] =>
    Array.isArray(value)
      ? value
          .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
          .map((v) => `${String(v[a] ?? "")}: ${String(v[b] ?? "")}`)
          .filter((line) => line.length > 2)
      : [];

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "fast",
    schemaName: "practice",
    schema: practiceSchema,
    system: [
      `Write ${count} practice questions on the lesson "${lesson.title}" for a Year`,
      `${student.yearGroup} child studying ${lesson.unit.programme.subject.title}.`,
      "",
      args.extension
        ? [
            "This child has finished the lesson comfortably and has time left in the period.",
            "Write questions that go FURTHER than the lesson's own quiz: apply the idea in an",
            "unfamiliar situation, combine it with something they already know, or ask them to",
            "explain why it works rather than only to get the answer. Still answerable from",
            "this lesson — stretch, not new material.",
          ].join(" ")
        : aimed.length > 0
        ? [
            "This child has just got some questions wrong, listed below. Every question you write",
            "must target what those mistakes reveal they have not understood — approach the same",
            "idea from a different angle, do not simply reword the questions they failed. Start",
            "easier than the question they missed and build back up to it.",
          ].join(" ")
        : [
            "These replace a worksheet, so they should work like one: start with the straightforward",
            "recall and build to something that needs the idea applied. Every question must be",
            "answerable from this lesson alone — never assume anything taught later.",
          ].join(" "),
      "",
      "This child is learning at home, alone, with only their teacher to talk to. Never write a",
      "task that needs a partner, a group, the class, or equipment — no 'discuss with a partner',",
      "no 'swap answers', no 'ask three people'. Where the skill genuinely is a two-person one",
      "(asking questions, debating, explaining to someone), the teacher is the other person: have",
      "them write their side, and say you will give yours once they have had a go.",
      "",
      "Use only SHORT_ANSWER, NUMERIC or MULTIPLE_CHOICE. For MULTIPLE_CHOICE give 3 or 4 choices",
      "with the correct one first and wrong ones that a child who half-understood would pick.",
      "For SHORT_ANSWER and NUMERIC list every acceptable answer, including spellings and forms a",
      "child would reasonably write.",
      "",
      "explanation: why the answer is right, in one or two sentences, addressed to the child.",
      "UK English.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Lesson: ${lesson.title}`,
          `Unit: ${lesson.unit.title}`,
          lesson.pupilOutcome ? `What they should be able to do: ${lesson.pupilOutcome}` : "",
          "",
          "Key learning points:",
          ...asStrings(lesson.keyLearningPoints).map((p) => `- ${p}`),
          "",
          "Keywords:",
          ...asPairs(lesson.keywords, "keyword", "description").map((k) => `- ${k}`),
          "",
          "Common misconceptions to write distractors around:",
          ...asPairs(lesson.misconceptions, "misconception", "response").map((m) => `- ${m}`),
          "",
          aimed.length > 0 ? `\nThey got these wrong:\n${aimed.map((p) => `- ${p}`).join("\n")}` : "",
          lesson.transcript ? `Transcript extract:\n${lesson.transcript.slice(0, 6000)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  return persistGeneratedQuestions(data.questions.slice(0, count), {
    lessonId: lesson.id,
    studentId: args.studentId,
    context: {
      lessonId: lesson.id,
      reason: args.extension
        ? "finished_early"
        : aimed.length > 0
          ? "missed_questions"
          : "no_practice_questions",
      ...(aimed.length > 0 ? { missedPrompts: aimed } : {}),
    },
    baseOrder: 900,
  });
}

// ───────────────────────────── observations ─────────────────────────────

const observationsSchema = z.object({
  observations: z.array(
    z.object({
      kind: z.enum(["STRENGTH", "DEVELOPING", "MISCONCEPTION"]),
      topic: z.string(),
      detail: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

/**
 * Maintains the structured learning profile (spec §23) — far more useful to the tutor than
 * months of raw chat. Repeated observations bump `occurrences` rather than duplicating.
 */
async function identifyMisconceptions(args: {
  studentId: string;
  lessonId: string;
  attempts: QuestionAttempt[];
}): Promise<AiLearningObservation[]> {
  if (!args.attempts.length) return [];

  const lesson = await prisma.lesson.findUnique({
    where: { id: args.lessonId },
    include: { unit: { include: { programme: true } } },
  });
  if (!lesson) return [];

  const questions = await prisma.question.findMany({
    where: { id: { in: args.attempts.map((a) => a.questionId) } },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));

  const lines = args.attempts.map((a) => {
    const q = byId.get(a.questionId);
    return [
      `Question: ${q?.prompt ?? "(unknown)"}`,
      `Answer: ${describeResponse(a.response)}`,
      `Marked: ${a.isCorrect ? "correct" : "incorrect"} (${a.score ?? 0}/${a.maxScore})`,
      a.feedback ? `Feedback given: ${a.feedback}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "fast",
    schemaName: "misconceptions",
    schema: observationsSchema,
    system: [
      `Review this child's answers in the lesson "${lesson.title}" and record what they reveal`,
      "about the child's understanding, for their long-term learning profile.",
      "",
      "Record only what the evidence supports. A single slip is not a misconception. Use:",
      "STRENGTH for something clearly secure, DEVELOPING for something partly there,",
      "MISCONCEPTION for a specific wrong idea. `topic` must be a short, reusable label such as",
      '"fractions: common denominators" — the same wording each time so repeats are recognised.',
      "Return an empty list if the answers show nothing worth recording.",
    ].join("\n"),
    messages: [{ role: "user", content: lines.join("\n\n") }],
  });

  const saved: AiLearningObservation[] = [];
  for (const o of data.observations) {
    const existing = await prisma.aiLearningObservation.findFirst({
      where: { studentId: args.studentId, topic: o.topic, kind: o.kind, active: true },
    });

    saved.push(
      existing
        ? await prisma.aiLearningObservation.update({
            where: { id: existing.id },
            data: {
              occurrences: existing.occurrences + 1,
              detail: o.detail,
              confidence: Math.max(existing.confidence, o.confidence),
              lastSeenAt: new Date(),
            },
          })
        : await prisma.aiLearningObservation.create({
            data: {
              studentId: args.studentId,
              subjectId: lesson.unit.programme.subjectId,
              lessonId: args.lessonId,
              kind: o.kind,
              topic: o.topic,
              detail: o.detail,
              confidence: o.confidence,
              source: "AI",
            },
          }),
    );
  }

  return saved;
}

export const teacherAgent = {
  chat,
  grade,
  summarizeLesson,
  summarizeDay,
  generatePractice,
  generateLessonPractice,
  identifyMisconceptions,
};

export type { LessonStage, TeacherMode };
