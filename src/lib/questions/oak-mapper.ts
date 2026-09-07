/**
 * Maps Oak's quiz question shapes (GET /lessons/{lesson}/quiz) and worksheet-derived
 * questions into the canonical `MappedQuestion` shape that `sync.ts` upserts as `Question`
 * rows. See docs/ARCHITECTURE.md §9 for the mapping table.
 */
import { createHash } from "node:crypto";
import type { ImageRef, Option, QuestionTypeName } from "./types";

export interface MappedQuestion {
  stage: "STARTER" | "CHECK" | "PRACTICE";
  order: number;
  type: QuestionTypeName;
  prompt: string;
  promptImage?: ImageRef;
  options?: unknown;
  answerKey: unknown;
  explanation?: string;
  maxScore: number;
  gradingMode: "DETERMINISTIC" | "AI";
  providerRef: string;
}

// ---------- Oak quiz question shapes (GET /lessons/{lesson}/quiz) ----------

interface OakImage {
  url: string;
  width: number;
  height: number;
  alt?: string;
  text?: string;
  attribution?: string;
}

interface OakTextAnswer {
  type: "text";
  content: string;
  distractor?: boolean;
}

interface OakImageAnswer {
  type: "image";
  content: OakImage;
  distractor?: boolean;
}

type OakMcAnswer = OakTextAnswer | OakImageAnswer;

interface OakShortAnswer {
  type: "text";
  content: string;
}

interface OakMatchAnswer {
  matchOption: { type: "text"; content: string };
  correctChoice: { type: "text"; content: string };
}

interface OakOrderAnswer {
  order: number;
  type: "text";
  content: string;
}

interface OakQuizQuestionBase {
  question: string;
  questionImage?: OakImage;
}

interface OakMcQuestion extends OakQuizQuestionBase {
  questionType: "multiple-choice";
  answers: OakMcAnswer[];
}

interface OakShortAnswerQuestion extends OakQuizQuestionBase {
  questionType: "short-answer";
  answers: OakShortAnswer[];
}

interface OakMatchQuestion extends OakQuizQuestionBase {
  questionType: "match";
  answers: OakMatchAnswer[];
}

interface OakOrderQuestion extends OakQuizQuestionBase {
  questionType: "order";
  answers: OakOrderAnswer[];
}

type OakQuizQuestion = OakMcQuestion | OakShortAnswerQuestion | OakMatchQuestion | OakOrderQuestion;

const KNOWN_QUESTION_TYPES = new Set(["multiple-choice", "short-answer", "match", "order"]);

function isOakQuizQuestion(value: unknown): value is OakQuizQuestion {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.question === "string" &&
    typeof q.questionType === "string" &&
    KNOWN_QUESTION_TYPES.has(q.questionType) &&
    Array.isArray(q.answers)
  );
}

function sha1(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

/** Base-26 letter ids: a, b, c … z, aa, ab … */
function letterId(index: number): string {
  let n = index;
  let id = "";
  do {
    id = String.fromCharCode(97 + (n % 26)) + id;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return id;
}

function toImageRef(img: OakImage): ImageRef {
  return { url: img.url, width: img.width, height: img.height, alt: img.alt ?? img.text, attribution: img.attribution };
}

function mcAnswerToOption(answer: OakMcAnswer, id: string): Option {
  if (answer.type === "image") {
    return { id, text: answer.content.alt ?? answer.content.text ?? "", image: toImageRef(answer.content) };
  }
  return { id, text: answer.content };
}

/**
 * Maps one Oak quiz question (starter or exit) into a `MappedQuestion`. Returns `null` when
 * the shape isn't recognised (unknown `questionType`, missing `answers`, or a multiple-choice
 * question with no non-distractor answer).
 */
export function mapOakQuizQuestion(q: unknown, stage: "STARTER" | "CHECK", order: number): MappedQuestion | null {
  if (!isOakQuizQuestion(q)) return null;
  const providerRef = sha1(q);
  const promptImage = q.questionImage ? toImageRef(q.questionImage) : undefined;

  switch (q.questionType) {
    case "multiple-choice": {
      const choices = q.answers.map((a, i) => mcAnswerToOption(a, letterId(i)));
      const correctOptionIds = q.answers
        .map((a, i) => ({ id: letterId(i), distractor: a.distractor === true }))
        .filter((c) => !c.distractor)
        .map((c) => c.id);
      if (correctOptionIds.length === 0) return null;
      const type: QuestionTypeName = correctOptionIds.length > 1 ? "MULTI_SELECT" : "MULTIPLE_CHOICE";
      const answerKey =
        type === "MULTI_SELECT" ? { correctOptionIds } : { correctOptionId: correctOptionIds[0] };
      return {
        stage,
        order,
        type,
        prompt: q.question,
        promptImage,
        options: { choices },
        answerKey,
        maxScore: 1,
        gradingMode: "DETERMINISTIC",
        providerRef,
      };
    }
    case "short-answer": {
      const accepted = q.answers
        .map((a) => a.content)
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0);
      return {
        stage,
        order,
        type: "SHORT_ANSWER",
        prompt: q.question,
        promptImage,
        answerKey: { accepted, caseSensitive: false },
        maxScore: 1,
        gradingMode: accepted.length > 0 ? "DETERMINISTIC" : "AI",
        providerRef,
      };
    }
    case "match": {
      const left = q.answers.map((a, i) => ({ id: letterId(i), text: a.matchOption.content }));
      const right = q.answers.map((a, i) => ({ id: letterId(i), text: a.correctChoice.content }));
      const pairs = q.answers.map((_, i) => ({ leftId: letterId(i), rightId: letterId(i) }));
      return {
        stage,
        order,
        type: "MATCHING",
        prompt: q.question,
        promptImage,
        options: { left, right },
        answerKey: { pairs },
        maxScore: 1,
        gradingMode: "DETERMINISTIC",
        providerRef,
      };
    }
    case "order": {
      const items = q.answers.map((a, i) => ({ id: letterId(i), text: a.content }));
      const idByAnswer = new Map(q.answers.map((a, i) => [a, letterId(i)] as const));
      const sorted = [...q.answers].sort((a, b) => a.order - b.order);
      const order_ = sorted.map((a) => idByAnswer.get(a)!);
      return {
        stage,
        order,
        type: "ORDERING",
        prompt: q.question,
        promptImage,
        options: { items },
        answerKey: { order: order_ },
        maxScore: 1,
        gradingMode: "DETERMINISTIC",
        providerRef,
      };
    }
    default:
      return null;
  }
}

// ---------- worksheet-derived questions (PRACTICE) ----------

export interface WorksheetQuestionInput {
  number: string;
  text: string;
  type?: string;
  answer?: string;
}

function normaliseWorksheetType(type?: string): "NUMERIC" | "SHORT_ANSWER" | "EXTENDED_TEXT" | undefined {
  switch (type?.toLowerCase()) {
    case "numeric":
    case "number":
      return "NUMERIC";
    case "short":
    case "short-answer":
    case "short_answer":
      return "SHORT_ANSWER";
    case "extended":
    case "extended-text":
    case "extended_text":
      return "EXTENDED_TEXT";
    default:
      return undefined;
  }
}

function parseNumericAnswer(raw: string): { value: number; tolerance: number; acceptedStrings?: string[] } | null {
  const trimmed = raw.trim();
  const fraction = trimmed.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const value = Number(fraction[1]) / Number(fraction[2]);
    if (Number.isFinite(value)) return { value, tolerance: 0, acceptedStrings: [trimmed] };
  }
  const numeric = trimmed.match(/-?\d+(\.\d+)?/);
  if (!numeric) return null;
  const value = Number(numeric[0]);
  if (Number.isNaN(value)) return null;
  return { value, tolerance: 0, acceptedStrings: [trimmed] };
}

/** Maps one PRACTICE-stage worksheet question (native fixture field, or from the worksheet pipeline). */
export function mapWorksheetQuestion(q: WorksheetQuestionInput, order: number): MappedQuestion {
  const providerRef = sha1({ kind: "worksheet", ...q });
  const answer = q.answer?.trim();
  const explicitType = normaliseWorksheetType(q.type);
  const numericAnswer = answer ? parseNumericAnswer(answer) : null;

  const type: "NUMERIC" | "SHORT_ANSWER" | "EXTENDED_TEXT" =
    explicitType ?? (numericAnswer ? "NUMERIC" : answer ? "SHORT_ANSWER" : "EXTENDED_TEXT");

  if (type === "NUMERIC") {
    return {
      stage: "PRACTICE",
      order,
      type: "NUMERIC",
      prompt: q.text,
      answerKey: numericAnswer ?? { value: 0, tolerance: 0 },
      maxScore: 1,
      gradingMode: "DETERMINISTIC",
      providerRef,
    };
  }

  if (type === "SHORT_ANSWER") {
    return {
      stage: "PRACTICE",
      order,
      type: "SHORT_ANSWER",
      prompt: q.text,
      answerKey: { accepted: answer ? [answer] : [], caseSensitive: false, modelAnswer: answer },
      maxScore: 1,
      gradingMode: answer ? "DETERMINISTIC" : "AI",
      providerRef,
    };
  }

  return {
    stage: "PRACTICE",
    order,
    type: "EXTENDED_TEXT",
    prompt: q.text,
    answerKey: { modelAnswer: answer },
    maxScore: 2,
    gradingMode: "AI",
    providerRef,
  };
}
