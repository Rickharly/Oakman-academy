/**
 * Deterministic grading (spec §15-17, ARCHITECTURE §5). No AI tokens spent here.
 *
 * `gradeDeterministic` returns `null` only for the one case where a deterministic
 * grader genuinely cannot decide: a SHORT_ANSWER question whose student text does not
 * normalise-match anything in `accepted` (including when `accepted` is empty) but is
 * non-empty — that is handed to AI grading by `src/lib/grading/grade.ts`. Every other
 * supported type always returns a definitive result.
 */
import type { Question } from "@/generated/prisma/client";
import {
  type GradeResult,
  type QuestionTypeName,
  matchingKeySchema,
  multiSelectKeySchema,
  multipleChoiceKeySchema,
  numericKeySchema,
  orderingKeySchema,
  responseSchemas,
  shortAnswerKeySchema,
  trueFalseKeySchema,
} from "@/lib/questions/types";

type DeterministicQuestion = Pick<Question, "type" | "options" | "answerKey" | "maxScore">;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** score/maxScore, guarding against a zero maxScore. */
function masteryOf(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.min(1, Math.max(0, score / maxScore));
}

function result(input: {
  score: number;
  maxScore: number;
  correct: boolean;
  feedbackForStudent: string;
  reasoningForParent: string;
  needsReview?: boolean;
}): GradeResult {
  const score = round2(input.score);
  return {
    score,
    maxScore: input.maxScore,
    correct: input.correct,
    mastery: masteryOf(score, input.maxScore),
    feedbackForStudent: input.feedbackForStudent,
    reasoningForParent: input.reasoningForParent,
    misconceptions: [],
    needsReview: input.needsReview ?? (!input.correct && masteryOf(score, input.maxScore) < 0.5),
  };
}

function emptyAnswerResult(maxScore: number): GradeResult {
  return result({
    score: 0,
    maxScore,
    correct: false,
    feedbackForStudent: "You didn't answer this one — have a go and see what you think.",
    reasoningForParent: "No response was submitted for this question.",
    needsReview: false,
  });
}

function invalidResponseResult(maxScore: number): GradeResult {
  return result({
    score: 0,
    maxScore,
    correct: false,
    feedbackForStudent: "That answer didn't come through properly — try again.",
    reasoningForParent: "The submitted response did not match the expected shape for this question type.",
    needsReview: false,
  });
}

// ---------- numeric parsing ----------

/**
 * Parses a free-typed numeric answer: plain decimals ("0.75"), simple fractions
 * ("3/4"), mixed numbers ("1 1/2"), negatives ("-2" or the unicode minus "−2"),
 * thousands separators ("1,000"), and strips surrounding "=" signs, whitespace and
 * units ("5cm", "£5", "12%"). Returns null when nothing numeric can be recovered.
 */
export function parseNumericAnswer(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;

  // strip a leading/trailing "=" (e.g. "= 5", "5 =")
  text = text.replace(/^=+\s*/, "").replace(/\s*=+$/, "").trim();
  // normalise the unicode minus sign to ASCII
  text = text.replace(/−/g, "-");
  // thousands separators
  text = text.replace(/(\d),(?=\d{3}(\D|$))/g, "$1");

  // pull out the numeric-looking core: optional sign, digits, optional "/digits",
  // optionally preceded by a whole-number part and a space (mixed number).
  const match = text.match(/-?\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?/);
  if (!match) return null;
  const core = match[0].trim();

  // mixed number: "1 1/2"
  const mixed = core.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den === 0) return null;
    const magnitude = Math.abs(whole) + num / den;
    return whole < 0 ? -magnitude : magnitude;
  }

  // simple fraction: "3/4"
  const fraction = core.match(/^(-?\d+)\/(\d+)$/);
  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);
    if (den === 0) return null;
    return num / den;
  }

  // plain decimal / integer
  if (/^-?\d+(\.\d+)?$/.test(core)) {
    return Number(core);
  }

  return null;
}

// ---------- short-answer normalisation ----------

const LEADING_ARTICLES = /^(the|a|an)\s+/i;
const TRAILING_PUNCTUATION = /[.,!?;:'"”’]+$/;

/** trim, lowercase (unless case-sensitive), collapse whitespace, strip trailing
 * punctuation and a single leading article ("the"/"a"/"an"). */
export function normaliseShortAnswer(text: string, caseSensitive = false): string {
  let s = text.trim().replace(/\s+/g, " ");
  s = s.replace(TRAILING_PUNCTUATION, "").trim();
  s = s.replace(LEADING_ARTICLES, "").trim();
  if (!caseSensitive) s = s.toLowerCase();
  return s;
}

// ---------- per-type graders ----------

function gradeMultipleChoice(answerKey: unknown, response: unknown, maxScore: number): GradeResult {
  const key = multipleChoiceKeySchema.parse(answerKey);
  const parsed = responseSchemas.MULTIPLE_CHOICE.safeParse(response);
  if (!parsed.success || !parsed.data.optionId) return emptyAnswerResult(maxScore);
  const correct = parsed.data.optionId === key.correctOptionId;
  return result({
    score: correct ? maxScore : 0,
    maxScore,
    correct,
    feedbackForStudent: correct
      ? "Well done — that's correct."
      : "Not quite. Look again at each option before you choose.",
    reasoningForParent: `Multiple choice: student chose "${parsed.data.optionId}"; ${correct ? "matches" : "does not match"} the correct option.`,
  });
}

function gradeMultiSelect(answerKey: unknown, response: unknown, maxScore: number): GradeResult {
  const key = multiSelectKeySchema.parse(answerKey);
  const parsed = responseSchemas.MULTI_SELECT.safeParse(response);
  const selected = parsed.success ? parsed.data.optionIds : [];
  if (selected.length === 0) return emptyAnswerResult(maxScore);

  const keySet = new Set(key.correctOptionIds);
  const selectedSet = new Set(selected);
  const correctCount = selected.filter((id) => keySet.has(id)).length;
  const wrongCount = selected.length - correctCount;
  const total = keySet.size || 1;
  const fraction = Math.max(0, (correctCount - wrongCount) / total);
  const fullCredit = selectedSet.size === keySet.size && [...keySet].every((id) => selectedSet.has(id));
  const score = fullCredit ? maxScore : round2(fraction * maxScore);

  let feedback: string;
  if (fullCredit) feedback = "Well done — you selected all the right options.";
  else if (correctCount > 0) feedback = "Good start — some of those are right, but check the others again.";
  else feedback = "Not quite — look carefully at each option again.";

  return result({
    score,
    maxScore,
    correct: fullCredit,
    feedbackForStudent: feedback,
    reasoningForParent: `Multi-select: ${correctCount} correct, ${wrongCount} incorrect out of ${selected.length} selected (${total} correct options total).`,
  });
}

function gradeTrueFalse(answerKey: unknown, response: unknown, maxScore: number): GradeResult {
  const key = trueFalseKeySchema.parse(answerKey);
  const parsed = responseSchemas.TRUE_FALSE.safeParse(response);
  if (!parsed.success) return emptyAnswerResult(maxScore);
  const correct = parsed.data.value === key.value;
  return result({
    score: correct ? maxScore : 0,
    maxScore,
    correct,
    feedbackForStudent: correct ? "Correct!" : "Not quite — think it through again.",
    reasoningForParent: `True/False: student answered ${parsed.data.value}; correct answer is ${key.value}.`,
  });
}

function gradeNumeric(answerKey: unknown, response: unknown, maxScore: number): GradeResult {
  const key = numericKeySchema.parse(answerKey);
  const parsed = responseSchemas.NUMERIC.safeParse(response);
  const raw = parsed.success ? parsed.data.text : "";
  const trimmed = raw.trim();
  if (!trimmed) return emptyAnswerResult(maxScore);

  const acceptedStrings = key.acceptedStrings ?? [];
  const exactMatch = acceptedStrings.some((accepted) => accepted.trim() === trimmed);
  if (exactMatch) {
    return result({
      score: maxScore,
      maxScore,
      correct: true,
      feedbackForStudent: "Well done — that's the right answer.",
      reasoningForParent: `Numeric: "${trimmed}" matched an accepted string exactly.`,
    });
  }

  const value = parseNumericAnswer(trimmed);
  if (value === null) {
    return result({
      score: 0,
      maxScore,
      correct: false,
      feedbackForStudent: "That doesn't look like a number — check how you've written your answer.",
      reasoningForParent: `Numeric: could not parse student answer "${trimmed}" as a number.`,
    });
  }

  const tolerance = key.tolerance ?? 0;
  const correct = Math.abs(value - key.value) <= tolerance;
  return result({
    score: correct ? maxScore : 0,
    maxScore,
    correct,
    feedbackForStudent: correct ? "Well done — that's the right number." : "Not quite — check your calculation.",
    reasoningForParent: `Numeric: parsed "${trimmed}" as ${value}; expected ${key.value} (± ${tolerance}).`,
  });
}

function gradeMatching(answerKey: unknown, response: unknown, maxScore: number): GradeResult {
  const key = matchingKeySchema.parse(answerKey);
  const parsed = responseSchemas.MATCHING.safeParse(response);
  const pairs = parsed.success ? parsed.data.pairs : [];
  if (pairs.length === 0) return emptyAnswerResult(maxScore);

  const responseMap = new Map(pairs.map((p) => [p.leftId, p.rightId]));
  const total = key.pairs.length || 1;
  const correctCount = key.pairs.filter((p) => responseMap.get(p.leftId) === p.rightId).length;
  const fullCredit = correctCount === total && pairs.length === total;
  const score = fullCredit ? maxScore : round2((correctCount / total) * maxScore);

  let feedback: string;
  if (fullCredit) feedback = "All matched correctly — well done.";
  else if (correctCount > 0) feedback = "Some pairs are right — take another look at the rest.";
  else feedback = "Not quite — try matching them again.";

  return result({
    score,
    maxScore,
    correct: fullCredit,
    feedbackForStudent: feedback,
    reasoningForParent: `Matching: ${correctCount}/${total} pairs correct.`,
  });
}

function gradeOrdering(answerKey: unknown, response: unknown, maxScore: number): GradeResult {
  const key = orderingKeySchema.parse(answerKey);
  const parsed = responseSchemas.ORDERING.safeParse(response);
  const order = parsed.success ? parsed.data.order : [];
  if (order.length === 0) return emptyAnswerResult(maxScore);

  const total = key.order.length || 1;
  let correctPositions = 0;
  for (let i = 0; i < key.order.length; i++) {
    if (order[i] === key.order[i]) correctPositions++;
  }
  const fullCredit = correctPositions === total && order.length === key.order.length;
  const score = fullCredit ? maxScore : round2((correctPositions / total) * maxScore);

  let feedback: string;
  if (fullCredit) feedback = "Perfect order!";
  else if (correctPositions > 0) feedback = "Getting there — some are in the wrong place.";
  else feedback = "Not quite — think about the order again.";

  return result({
    score,
    maxScore,
    correct: fullCredit,
    feedbackForStudent: feedback,
    reasoningForParent: `Ordering: ${correctPositions}/${total} positions correct.`,
  });
}

/** Returns null when `accepted` has nothing usable to match against, or when the
 * (non-empty) student text does not normalise-match anything accepted — both defer
 * to AI grading. Returns an incorrect result when the student left it blank. */
function gradeShortAnswer(answerKey: unknown, response: unknown, maxScore: number): GradeResult | null {
  const key = shortAnswerKeySchema.parse(answerKey);
  const parsed = responseSchemas.SHORT_ANSWER.safeParse(response);
  const text = parsed.success ? parsed.data.text.trim() : "";
  if (!text) return emptyAnswerResult(maxScore);

  const normalisedAnswer = normaliseShortAnswer(text, key.caseSensitive);
  const matched = key.accepted.some(
    (accepted) => normaliseShortAnswer(accepted, key.caseSensitive) === normalisedAnswer,
  );
  if (!matched) return null;

  return result({
    score: maxScore,
    maxScore,
    correct: true,
    feedbackForStudent: "Well done — that's correct.",
    reasoningForParent: `Short answer: "${text}" matched an accepted answer after normalisation.`,
  });
}

const DETERMINISTIC_GRADERS: Partial<
  Record<QuestionTypeName, (answerKey: unknown, response: unknown, maxScore: number) => GradeResult>
> = {
  MULTIPLE_CHOICE: gradeMultipleChoice,
  MULTI_SELECT: gradeMultiSelect,
  TRUE_FALSE: gradeTrueFalse,
  NUMERIC: gradeNumeric,
  MATCHING: gradeMatching,
  ORDERING: gradeOrdering,
};

/**
 * Deterministic grading for the DETERMINISTIC_TYPES plus SHORT_ANSWER-with-accepted-
 * answers. Returns `null` to signal "hand this to AI grading" (only reachable via
 * SHORT_ANSWER). Never called for EXTENDED_TEXT by `grade.ts`, but returns `null` for
 * it too, defensively.
 */
export function gradeDeterministic(question: DeterministicQuestion, response: unknown): GradeResult | null {
  const maxScore = question.maxScore;

  if (question.type === "SHORT_ANSWER") {
    return gradeShortAnswer(question.answerKey, response, maxScore);
  }

  const grader = DETERMINISTIC_GRADERS[question.type as QuestionTypeName];
  if (!grader) {
    // EXTENDED_TEXT (or anything else with no deterministic grader) always goes to AI.
    return null;
  }

  try {
    return grader(question.answerKey, response, maxScore);
  } catch {
    // Malformed answerKey (shouldn't happen for well-formed data) — treat as ungradeable.
    return invalidResponseResult(maxScore);
  }
}
