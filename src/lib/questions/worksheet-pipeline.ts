/**
 * Worksheet PDF → PRACTICE questions pipeline (docs/ARCHITECTURE.md §9):
 * PDF → text (`pdf-parse`) → numbered question splitter → optional AI structuring into
 * canonical questions → `Question` rows (`source OAK_WORKSHEET`, `stage PRACTICE`); the PDF
 * itself remains as a `LessonResource` fallback regardless of whether structuring succeeds.
 *
 * `structureWorksheet` takes an `AiProvider`-shaped object. `src/lib/ai/provider.ts` is being
 * written by another engineer; rather than importing a module that may not exist yet, the
 * shape is declared locally, structurally identical to the `AiProvider` contract in
 * docs/CONTRACTS.md — a real `AiProvider` instance satisfies it via structural typing.
 */
import { z } from "zod";
import { PDFParse } from "pdf-parse";
import { mapWorksheetQuestion, type MappedQuestion } from "./oak-mapper";

// ---------- local structural stand-in for src/lib/ai/provider.ts's AiProvider ----------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StructuredRequest<T> {
  model: "fast" | "strong";
  system: string;
  messages: ChatMessage[];
  schema: z.ZodType<T>;
  schemaName: string;
}

/** Structural subset of `AiProvider` (docs/CONTRACTS.md) that this pipeline needs. */
export interface AiProvider {
  structured<T>(req: StructuredRequest<T>): Promise<{ data: T; model: string; tokensIn?: number; tokensOut?: number }>;
}

// ---------- extraction ----------

/** Extracts plain text from a worksheet PDF buffer. */
export async function extractWorksheetText(pdf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(pdf) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

// ---------- numbered-question splitting ----------

export interface SplitWorksheetQuestion {
  number: string;
  text: string;
}

/**
 * Splits worksheet text on numbered-question markers at line starts: "1.", "1)", "Q1",
 * "Question 1". Text between one marker and the next (or end of text) becomes that
 * question's body. Lines before the first marker (a title, instructions) are discarded.
 */
export function splitWorksheetQuestions(text: string): SplitWorksheetQuestion[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const markerRe = /^\s*(?:Q(?:uestion)?\.?\s*(\d+)|(\d+)[.)])\s*(.*)$/i;

  const questions: SplitWorksheetQuestion[] = [];
  let current: { number: string; parts: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(markerRe);
    if (match) {
      if (current) {
        questions.push({ number: current.number, text: current.parts.join(" ").replace(/\s+/g, " ").trim() });
      }
      const number = match[1] ?? match[2] ?? "";
      const rest = match[3] ?? "";
      current = { number, parts: rest ? [rest] : [] };
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed) current.parts.push(trimmed);
    }
  }
  if (current) {
    questions.push({ number: current.number, text: current.parts.join(" ").replace(/\s+/g, " ").trim() });
  }

  return questions.filter((q) => q.text.length > 0);
}

// ---------- AI structuring ----------

const structuredQuestionSchema = z.object({
  number: z.string(),
  type: z.enum(["numeric", "short", "extended"]),
  prompt: z.string(),
  // Nullable, not optional: structured outputs reject an optional field outright.
  answer: z.string().nullable(),
});

export const structuredWorksheetSchema = z.object({
  questions: z.array(structuredQuestionSchema),
});

export interface StructureWorksheetInput {
  lessonTitle: string;
  questions: SplitWorksheetQuestion[];
  answersText?: string;
}

/**
 * Uses the AI provider to turn split worksheet questions (and an optional answers-sheet text)
 * into canonical `MappedQuestion`s (stage PRACTICE), inferring a question type and, where the
 * answers text supplies one, an answer key. Falls back to the deterministic heuristic in
 * `mapWorksheetQuestion` for any question the model omits.
 */
export async function structureWorksheet(input: StructureWorksheetInput, ai: AiProvider): Promise<MappedQuestion[]> {
  if (input.questions.length === 0) return [];

  const system =
    "You turn a school worksheet's questions into a structured list for an automated marking system. " +
    "For each question, classify it as 'numeric' (a single number/measurement answer), 'short' (a short " +
    "factual phrase), or 'extended' (a sentence or more of explanation). Keep the prompt text close to the " +
    "original wording. When the answers sheet text gives this question's answer, include it verbatim in " +
    "`answer`; otherwise omit `answer`. Preserve the original question `number`.";

  const userLines = [
    `Lesson: ${input.lessonTitle}`,
    "",
    "Questions:",
    ...input.questions.map((q) => `${q.number}. ${q.text}`),
  ];
  if (input.answersText) {
    userLines.push("", "Answers sheet:", input.answersText);
  }

  const { data } = await ai.structured({
    model: "fast",
    system,
    messages: [{ role: "user", content: userLines.join("\n") }],
    schema: structuredWorksheetSchema,
    schemaName: "structured_worksheet",
  });

  const byNumber = new Map(data.questions.map((q) => [q.number, q]));

  return input.questions.map((q, i) => {
    const structured = byNumber.get(q.number);
    if (!structured) return mapWorksheetQuestion({ number: q.number, text: q.text }, i + 1);
    return mapWorksheetQuestion(
      { number: q.number, text: structured.prompt || q.text, type: structured.type, answer: structured.answer ?? undefined },
      i + 1,
    );
  });
}
