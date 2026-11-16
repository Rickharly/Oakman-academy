/**
 * "He's getting the same questions again."
 *
 * A question a child has already got right is not practice, it is a chore, and they notice.
 * They were coming back by five routes, none of which knew about the others:
 *
 * - The "do you already know this?" check at the start of a lesson was made of the lesson's
 *   own end-of-lesson quiz, so a child who did not pass it answered the same questions again
 *   forty minutes later.
 * - A lesson carried over, or reviewed, opens a new attempt with the same quiz.
 * - Oak's starter quiz often reuses the previous lesson's exit quiz, word for word.
 * - Practice the teacher wrote for them is kept, so it reappears in the next attempt.
 * - When the teacher was asked for more questions and wrote repeats, the repeats were used.
 *
 * So there is one record of what each child has already answered correctly, across lessons,
 * exams and pre-checks, and everything that puts a question in front of them consults it.
 * A question they got WRONG still comes back. That is deliberate: being asked again is how
 * they learn it, and it is what the family asked for.
 */
import type { Question } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** The fewest end-of-lesson questions worth marking a lesson on. */
export const MIN_CHECK_QUESTIONS = 3;

/** A question's wording reduced to what a child would recognise. */
export function promptKey(prompt: string): string {
  return prompt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(prompt: string): Set<string> {
  // Numbers left out on purpose: "What is 3 × 4?" and "What is 5 × 6?" are the same question
  // to a child who has just done one of them.
  return new Set(
    promptKey(prompt)
      .split(" ")
      .filter((w) => w.length > 1 && !/^\d+$/.test(w)),
  );
}

/**
 * True when a child would say "I've had this one".
 *
 * Identical wording, or the same wording with the numbers or a word or two changed. Only used
 * to vet questions the teacher has just written — a provider's own quiz is matched on exact
 * wording, because two of its questions that share a template really are different questions.
 */
export function looksLikeSameQuestion(a: string, b: string): boolean {
  if (promptKey(a) === promptKey(b)) return true;
  const x = words(a);
  const y = words(b);
  if (x.size < 4 || y.size < 4) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return shared / (x.size + y.size - shared) >= 0.8;
}

export interface AlreadyRight {
  ids: Set<string>;
  keys: Set<string>;
}

/** True when this question, or one worded the same, has already been answered correctly. */
export function wasAnsweredRight(q: Pick<Question, "id" | "prompt">, right: AlreadyRight): boolean {
  return right.ids.has(q.id) || right.keys.has(promptKey(q.prompt));
}

const PRE_CHECK_LOG = "pre_check_correct";

/** Records which pre-check questions were right, so the lesson's quiz does not ask them again. */
export async function recordPreCheckCorrect(
  studentId: string,
  lessonId: string,
  questionIds: string[],
): Promise<void> {
  if (questionIds.length === 0) return;
  await prisma.activityLog.create({
    data: { studentId, kind: PRE_CHECK_LOG, data: { lessonId, questionIds } },
  });
}

/**
 * Of these questions, which has this child already answered correctly somewhere else?
 *
 * "Somewhere else" is any other lesson attempt, any exam, any pre-check. Looked up by id and by
 * exact wording, so the same Oak question stored under two lessons counts as the same question.
 *
 * `before` freezes the answer for one attempt: only answers given before it started count, so
 * a question cannot vanish from a quiz the child is in the middle of because they answered it
 * in another tab.
 */
export async function alreadyAnsweredRight(
  studentId: string,
  candidates: Pick<Question, "id" | "prompt">[],
  opts: { exceptAttemptId?: string; before?: Date } = {},
): Promise<AlreadyRight> {
  const right: AlreadyRight = { ids: new Set(), keys: new Set() };
  if (candidates.length === 0) return right;

  const ids = candidates.map((q) => q.id);
  const prompts = [...new Set(candidates.map((q) => q.prompt))];
  const sameQuestion = { OR: [{ id: { in: ids } }, { prompt: { in: prompts } }] };

  const [inLessons, inExams, preChecks] = await Promise.all([
    prisma.questionAttempt.findMany({
      where: {
        studentId,
        isCorrect: true,
        ...(opts.exceptAttemptId ? { activityAttempt: { lessonAttemptId: { not: opts.exceptAttemptId } } } : {}),
        ...(opts.before ? { submittedAt: { lt: opts.before } } : {}),
        question: sameQuestion,
      },
      select: { question: { select: { id: true, prompt: true } } },
    }),
    prisma.examQuestion.findMany({
      where: {
        isCorrect: true,
        exam: { studentId },
        ...(opts.before ? { answeredAt: { lt: opts.before } } : {}),
        question: sameQuestion,
      },
      select: { question: { select: { id: true, prompt: true } } },
    }),
    prisma.activityLog.findMany({
      where: { studentId, kind: PRE_CHECK_LOG },
      select: { data: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  for (const row of [...inLessons, ...inExams]) {
    right.ids.add(row.question.id);
    right.keys.add(promptKey(row.question.prompt));
  }

  const preCheckIds = new Set<string>();
  for (const log of preChecks) {
    const list = (log.data as { questionIds?: unknown } | null)?.questionIds;
    if (Array.isArray(list)) for (const id of list) if (typeof id === "string") preCheckIds.add(id);
  }
  if (preCheckIds.size > 0) {
    const byId = new Map(candidates.map((q) => [q.id, q]));
    const missing = [...preCheckIds].filter((id) => !byId.has(id));
    const others = missing.length
      ? await prisma.question.findMany({ where: { id: { in: missing } }, select: { id: true, prompt: true } })
      : [];
    for (const q of [...candidates.filter((c) => preCheckIds.has(c.id)), ...others]) {
      right.ids.add(q.id);
      right.keys.add(promptKey(q.prompt));
    }
  }

  return right;
}

/**
 * The questions to put in front of a child for one stage, without the ones they have already
 * got right.
 *
 * - Anything they have already answered in THIS attempt stays, so a reload never takes away a
 *   question they are looking at their own answer to.
 * - The end-of-lesson quiz never drops below `MIN_CHECK_QUESTIONS` (or the whole quiz, if it is
 *   shorter): a lesson is marked on it, and two questions is not a mark. When too few fresh
 *   ones are left, the earliest of the already-right ones come back to make up the number.
 *   Fresh questions written for them (`fresh-questions.ts`) are what normally fills that gap.
 * - Every other stage may simply get shorter, or empty: a child who already knows every starter
 *   question has nothing to warm up on, and the player moves on.
 */
export function withoutRepeats<Q extends Pick<Question, "id" | "prompt" | "stage">>(
  questions: Q[],
  right: AlreadyRight,
  answeredHere: Set<string>,
): Q[] {
  const keep = (q: Q) => answeredHere.has(q.id) || !wasAnsweredRight(q, right);
  const check = questions.filter((q) => q.stage === "CHECK");
  const keptCheck = new Set(check.filter(keep).map((q) => q.id));
  const floor = Math.min(MIN_CHECK_QUESTIONS, check.length);
  for (const q of check) {
    if (keptCheck.size >= floor) break;
    keptCheck.add(q.id);
  }
  return questions.filter((q) => (q.stage === "CHECK" ? keptCheck.has(q.id) : keep(q)));
}
