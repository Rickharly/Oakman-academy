/**
 * Which `ActivityAttempt` a graded stage's score/status is read from.
 *
 * A stage can have more than one round on the books: a retried CHECK question, or a PRACTICE
 * stage finished through the extra-practice path (`/api/lessons/[lessonId]/practice/submit`)
 * where `submitStage` later had nothing left of its own to grade and stamped a fresh, empty
 * round (`score: 0, maxScore: 0`) as GRADED just to move the lesson on. `pickLatest` answers
 * "what happened last" — was this stage submitted at all, is a retry open right now.
 * `pickLatestWithMarks` answers "what did the child actually score" — it skips past a later
 * round that graded zero questions to the most recent round before it that carries real marks,
 * so a lesson finished with real work in it never reads back as "0 out of 0".
 *
 * Plain, side-effect-free, and framework-free on purpose: the same picking rule has to agree
 * between the lesson player (React state) and anything that inspects `ActivityAttempt` rows
 * directly (tests, admin inspection), so it lives where both can import it without pulling in
 * `"use client"` or Prisma types.
 */
export type ScoredActivity = {
  stage: "STARTER" | "PRACTICE" | "CHECK";
  score: number | null;
  maxScore: number | null;
};

/** The chronologically latest activity for `stage` — status, not score. */
export function pickLatest<T extends ScoredActivity>(activities: readonly T[], stage: T["stage"]): T | undefined {
  const filtered = activities.filter((a) => a.stage === stage);
  return filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
}

/**
 * The latest activity for `stage` that actually carries marks (`maxScore > 0`), falling back to
 * the true latest only when every round for this stage graded nothing at all.
 */
export function pickLatestWithMarks<T extends ScoredActivity>(activities: readonly T[], stage: T["stage"]): T | undefined {
  const filtered = activities.filter((a) => a.stage === stage);
  for (let i = filtered.length - 1; i >= 0; i -= 1) {
    if ((filtered[i].maxScore ?? 0) > 0) return filtered[i];
  }
  return filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
}
