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

/** The passage a child should read next: the lowest-ordered one they have not responded to. */
export async function getNextReadingText(studentId: string): Promise<ReadingText | null> {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) return null;

  const done = await prisma.readingEntry.findMany({
    where: { studentId },
    select: { readingTextId: true },
    distinct: ["readingTextId"],
  });
  const doneIds = done.map((d) => d.readingTextId);

  return prisma.readingText.findFirst({
    where: { yearGroup: student.yearGroup, id: { notIn: doneIds.length ? doneIds : undefined } },
    orderBy: { order: "asc" },
  });
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
export async function submitReadingResponse(input: {
  studentId: string;
  readingTextId: string;
  promptIndex: number | null;
  response: string;
  assignmentId?: string;
}): Promise<ReadingEntry> {
  const text = await prisma.readingText.findUnique({ where: { id: input.readingTextId } });
  if (!text) throw new ApiError(404, "Reading text not found");

  const trimmed = input.response.trim();
  if (trimmed.length < 2) throw new ApiError(400, "Write a little more before sending it.");

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
