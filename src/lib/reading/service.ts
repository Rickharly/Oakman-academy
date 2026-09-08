/**
 * Reading (spec: literacy). A child reads a passage on screen, writes a response, and the
 * teacher writes back — the way a reading journal works in school.
 *
 * Short responses are *answered*, not scored: a few sentences about a story should get a
 * reply and a follow-up question, not a mark out of ten. Essays are marked properly, because
 * that is the point of an essay.
 */
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import { getAiProvider } from "@/lib/ai/provider";
import { z } from "zod";
import type { ReadingEntry, ReadingText } from "@/generated/prisma/client";

export type ReadingPrompt = { index: number; text: string };

/**
 * The passage a child should read next.
 *
 * When a class novel is set for their year group they carry on with it, a chapter at a time —
 * that is what reading in school actually looks like. With no book set they get the next
 * standalone passage, which is what the short comprehension and poetry days are for.
 */
export async function getNextReadingText(studentId: string): Promise<ReadingText | null> {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) return null;

  const done = await prisma.readingEntry.findMany({
    where: { studentId },
    select: { readingTextId: true },
    distinct: ["readingTextId"],
  });
  const doneIds = done.map((d) => d.readingTextId);
  const notDone = doneIds.length ? { notIn: doneIds } : undefined;

  const book = await prisma.book.findFirst({
    where: { yearGroup: student.yearGroup, active: true },
  });

  if (book) {
    const chapter = await prisma.readingText.findFirst({
      where: { bookId: book.id, id: notDone },
      orderBy: { chapterNumber: "asc" },
    });
    // Finished the book: fall through to the standalone passages rather than stopping.
    if (chapter) return ensurePrompts(chapter, book.title);
  }

  const forYear = await prisma.readingText.findFirst({
    where: { yearGroup: student.yearGroup, bookId: null, id: notDone },
    orderBy: { order: "asc" },
  });
  if (forYear) return forYear;

  // Nothing written for this exact year. Rather than leave a child with no reading at all,
  // fall back to the nearest year we do have — a Year 4 reader is far better served by a
  // Year 5 passage than by an empty page.
  const candidates = await prisma.readingText.findMany({
    where: { bookId: null, id: notDone },
    orderBy: { order: "asc" },
  });
  if (candidates.length === 0) return null;

  const nearest = candidates.reduce((best, text) =>
    Math.abs(text.yearGroup - student.yearGroup) < Math.abs(best.yearGroup - student.yearGroup)
      ? text
      : best,
  );
  return candidates.find((t) => t.yearGroup === nearest.yearGroup) ?? null;
}

const chapterPromptsSchema = z.object({
  prompts: z.array(z.string()).min(2).max(4),
  vocabulary: z.array(z.object({ word: z.string(), meaning: z.string() })).max(5),
});

/**
 * Book chapters arrive from Gutenberg as plain text, so their questions are written the first
 * time the chapter is served and then kept.
 *
 * Doing it lazily rather than at import means a 34-chapter novel costs nothing for the
 * chapters nobody reaches, and doing it once rather than per view means a child who comes back
 * to a chapter sees the same questions they saw yesterday.
 */
async function ensurePrompts(chapter: ReadingText, bookTitle: string): Promise<ReadingText> {
  if (asPrompts(chapter.prompts).length > 0) return chapter;

  try {
    const ai = getAiProvider();
    const { data } = await ai.structured({
      model: "fast",
      schemaName: "chapterPrompts",
      schema: chapterPromptsSchema,
      system: [
        `You are an English teacher setting reading-journal questions on a chapter of "${bookTitle}".`,
        "",
        "Write three questions about THIS chapter, in this order:",
        "1. Something they can answer by looking back at the text.",
        "2. Something that asks them to infer — why a character did or said something.",
        "3. Something that asks what they think, with no right answer.",
        "",
        "Ask only about what is actually in the passage. Never refer to events from later in",
        "the book, and never assume they have read it before.",
        "",
        "vocabulary: up to 4 words from this chapter a child might not know, with a short",
        "plain-English meaning as used here. Older words are the point — do not skip them.",
        "",
        "UK English. Speak to the child directly.",
      ].join("\n"),
      messages: [{ role: "user", content: chapter.body.slice(0, 12_000) }],
    });

    return await prisma.readingText.update({
      where: { id: chapter.id },
      data: { prompts: data.prompts, vocabulary: data.vocabulary },
    });
  } catch {
    // A chapter with a general question is still a readable chapter.
    return {
      ...chapter,
      prompts: ["What happened in this chapter, and what did you make of it?"],
    };
  }
}

export async function getReadingText(id: string): Promise<ReadingText | null> {
  return prisma.readingText.findUnique({ where: { id } });
}

/** Everything a child has written about reading, newest first. */
export async function getReadingHistory(studentId: string, take = 30) {
  return prisma.readingEntry.findMany({
    where: { studentId },
    include: { readingText: true },
    orderBy: { submittedAt: "desc" },
    take,
  });
}

const responseFeedbackSchema = z.object({
  feedback: z.string(),
  reasoning: z.string(),
  strengths: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

const essayFeedbackSchema = responseFeedbackSchema.extend({
  score: z.number(),
});

function asPrompts(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Records what a child wrote and asks the teacher to reply.
 *
 * The AI call is wrapped: if it fails, the writing is still saved. Losing a child's work
 * because a model was briefly unavailable would be unforgivable; they can always be replied
 * to later.
 */
/**
 * How the time spent compares with how long the passage should take.
 *
 * A judgement for the parent, not a mark. Children reread, get interrupted, and read at
 * different speeds, so the bands are wide: this is meant to catch "clicked straight through
 * a 2,000-word chapter in forty seconds", not to police a slow reader.
 */
export function judgePace(readingSeconds: number, wordCount: number): "rushed" | "steady" | "slow" {
  // 180 words a minute is a careful child reading unfamiliar prose.
  const expected = Math.max(30, (wordCount / 180) * 60);
  if (readingSeconds < expected * 0.4) return "rushed";
  if (readingSeconds > expected * 3) return "slow";
  return "steady";
}

export async function submitReadingResponse(input: {
  studentId: string;
  readingTextId: string;
  promptIndex: number | null;
  response: string;
  assignmentId?: string;
  readingSeconds?: number;
}): Promise<ReadingEntry> {
  const text = await prisma.readingText.findUnique({ where: { id: input.readingTextId } });
  if (!text) throw new ApiError(404, "Reading text not found");

  const trimmed = input.response.trim();
  if (trimmed.length < 2) throw new ApiError(400, "Write a little more before sending it.");

  const readingSeconds =
    input.readingSeconds == null
      ? null
      : Math.max(0, Math.min(Math.round(input.readingSeconds), 4 * 60 * 60));

  const isEssay = input.promptIndex === null && Boolean(text.essayPrompt);
  const prompts = asPrompts(text.prompts);
  const prompt = isEssay
    ? (text.essayPrompt as string)
    : (prompts[input.promptIndex ?? 0] ?? "What did you think about what you read?");

  const entry = await prisma.readingEntry.create({
    data: {
      studentId: input.studentId,
      readingTextId: text.id,
      assignmentId: input.assignmentId ?? null,
      kind: isEssay ? "ESSAY" : "RESPONSE",
      prompt,
      response: trimmed,
      maxScore: isEssay ? 8 : null,
      // Clamped: the browser reports this, and a tab left open overnight is not eight hours
      // of reading.
      readingSeconds: readingSeconds ?? null,
      readingPace: readingSeconds == null ? null : judgePace(readingSeconds, text.wordCount),
    },
  });

  // Writing something about the passage is what the slot asks for, so the slot is done. A
  // child can keep answering the other prompts afterwards; the day just stops nagging them.
  if (input.assignmentId) {
    await prisma.dailyAssignment.updateMany({
      where: { id: input.assignmentId, studentId: input.studentId, status: { not: "COMPLETED" } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  try {
    const graded = await respondToReading(entry.id);
    return graded;
  } catch {
    // The response is saved; the teacher's reply can come later.
    return entry;
  }
}

/** Asks the teacher to reply to one saved entry, and stores the reply. */
export async function respondToReading(entryId: string): Promise<ReadingEntry> {
  const entry = await prisma.readingEntry.findUnique({
    where: { id: entryId },
    include: { readingText: true, student: { include: { user: true } } },
  });
  if (!entry) throw new ApiError(404, "Reading entry not found");

  const ai = getAiProvider();
  const isEssay = entry.kind === "ESSAY";
  const year = entry.student.yearGroup;

  const system = [
    `You are an English teacher replying to ${entry.student.user.displayName}, a Year ${year} child,`,
    `about their writing on a passage called "${entry.readingText.title}".`,
    "",
    isEssay
      ? [
          `Mark this piece out of ${entry.maxScore ?? 8}. Reward understanding of the text and`,
          "evidence used to support a point. Do not deduct marks for spelling or handwriting-style",
          "slips unless the question is about accuracy.",
        ].join(" ")
      : [
          "This is a short reading-journal response, not an exam answer. Do NOT give it a mark.",
          "Reply the way a good teacher replies in the margin: notice something specific they said,",
          "and ask one genuine follow-up question that sends them back to the text.",
        ].join(" "),
    "",
    "feedback: speak TO the child, warmly and specifically. Name something they actually wrote.",
    isEssay
      ? "Then one clear thing that would make it stronger. Under 120 words."
      : "End with a single question. Under 80 words.",
    "reasoning: one or two sentences for the parent's records, never shown to the child.",
    "strengths: short phrases naming what they did well.",
    "nextSteps: short phrases naming what to work on. Empty if there is nothing worth saying.",
    "",
    "UK English. Never invent something they did not write.",
  ].join("\n");

  const userContent = [
    `The passage they read:\n"""\n${entry.readingText.body}\n"""`,
    "",
    `The question: ${entry.prompt}`,
    "",
    `What they wrote:\n"""\n${entry.response}\n"""`,
  ].join("\n");

  const { data, model } = isEssay
    ? await ai.structured({
        model: "strong",
        schemaName: "readingEssay",
        schema: essayFeedbackSchema,
        system,
        messages: [{ role: "user", content: userContent }],
      })
    : await ai.structured({
        model: "fast",
        schemaName: "readingResponse",
        schema: responseFeedbackSchema,
        system,
        messages: [{ role: "user", content: userContent }],
      });

  const score =
    isEssay && "score" in data
      ? Math.max(0, Math.min(entry.maxScore ?? 8, (data as { score: number }).score))
      : null;

  return prisma.readingEntry.update({
    where: { id: entry.id },
    data: {
      feedback: data.feedback,
      reasoning: data.reasoning,
      strengths: data.strengths,
      nextSteps: data.nextSteps,
      score,
      gradedAt: new Date(),
      model,
    },
  });
}

/** Minutes of reading and pieces written, for the parent's overview. */
export async function getReadingSummary(studentId: string) {
  const [entries, essays] = await Promise.all([
    prisma.readingEntry.count({ where: { studentId } }),
    prisma.readingEntry.count({ where: { studentId, kind: "ESSAY" } }),
  ]);
  const textsRead = await prisma.readingEntry.findMany({
    where: { studentId },
    select: { readingTextId: true },
    distinct: ["readingTextId"],
  });
  return { entries, essays, textsRead: textsRead.length };
}
