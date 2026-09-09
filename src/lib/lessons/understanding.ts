/**
 * Making sure they actually understood it.
 *
 * A school marks the quiz and moves on to the next lesson, because a school has thirty children
 * and a syllabus. A tutor has one child and one job: they do not leave the table until the
 * thing is understood. This is that difference, in code.
 *
 * When a check goes badly the app used to show a score and offer to carry on. Now it finds out
 * *what* was not understood — the idea, not the question — and then works at it: explaining it
 * a different way each round, practising just that, and finally asking the child to say it back
 * in their own words. A gap closes only when both of those land, because getting questions right
 * can be pattern-matching, and explaining it back is the thing that cannot be faked.
 *
 * The rule that makes it a tutor rather than a loop: never re-run an explanation that already
 * failed. Each round picks a strategy that has not been tried — plainer words, a comparison to
 * something they know, one worked all the way through, teaching it back as a game, or going
 * back to the step underneath and rebuilding. If all of those are spent, the honest move is to
 * park it for another day rather than grind a tired child, and it comes back as review.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAiProvider } from "@/lib/ai/provider";
import type { TeachingStrategy, UnderstandingGap } from "@/generated/prisma/client";

/** The order the strategies are reached for. Cheapest change of tack first. */
export const STRATEGY_ORDER: TeachingStrategy[] = [
  "SIMPLER",
  "ANALOGY",
  "WORKED_EXAMPLE",
  "ROLE_PLAY",
  "BUILD_UP",
];

const STRATEGY_BRIEF: Record<TeachingStrategy, string> = {
  SIMPLER:
    "Say the same thing with half the words and one idea per sentence. No subject vocabulary at all unless you build it from scratch. Assume the first explanation went over their head, because it did.",
  ANALOGY:
    "Compare it to something they already understand from ordinary life — sharing food, a game they play, money, time. Carry the comparison all the way through rather than mentioning it and moving on.",
  WORKED_EXAMPLE:
    "Do one completely yourself, thinking out loud, saying why you do each step and not just what you do. Then set them one that is nearly the same.",
  ROLE_PLAY:
    "Turn it round: they are the teacher and you are the one who does not get it. Ask them a slightly wrong question and let them correct you, or set up a small story where the idea is needed to solve something.",
  BUILD_UP:
    "Go back one step to the thing this rests on, check they have that, and rebuild from there. If they cannot share ten sweets between two people, fractions were never the problem.",
};

/** Below this the check has not landed and the tutoring loop opens. */
export const UNDERSTOOD_THRESHOLD = 0.7;

// ───────────────────────────── diagnosis ─────────────────────────────

export const gapsSchema = z.object({
  gaps: z
    .array(
      z.object({
        /** In a parent's words: "what the bottom number of a fraction counts". */
        concept: z.string(),
        /** What their answers show they believe instead. This is what gets corrected. */
        misunderstanding: z.string(),
      }),
    )
    .max(3),
});

/**
 * What they did not understand, from what they actually wrote.
 *
 * Deliberately at most three: a child who got everything wrong needs one thing fixed first, not
 * a list of six failures. And deliberately concepts rather than questions — "question 3 was
 * wrong" is not something you can teach.
 */
export async function diagnoseGaps(lessonAttemptId: string, studentId: string): Promise<UnderstandingGap[]> {
  const attempt = await prisma.lessonAttempt.findFirst({
    where: { id: lessonAttemptId, studentId },
    include: { lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } } },
  });
  if (!attempt) return [];

  // Already diagnosed for this attempt: the loop is resumed, not restarted.
  const existing = await prisma.understandingGap.findMany({
    where: { lessonAttemptId, status: { in: ["OPEN", "UNDERSTOOD"] } },
    orderBy: { openedAt: "asc" },
  });
  if (existing.length > 0) return existing;

  const wrong = await prisma.questionAttempt.findMany({
    where: {
      studentId,
      isCorrect: false,
      activityAttempt: { lessonAttemptId, stage: { in: ["CHECK", "PRACTICE"] } },
    },
    include: { question: { select: { prompt: true, explanation: true } } },
    orderBy: { submittedAt: "desc" },
    take: 12,
  });
  if (wrong.length === 0) return [];

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "strong",
    schemaName: "understanding_gaps",
    schema: gapsSchema,
    system: [
      "You are a tutor looking at what one child got wrong, working out what to teach next.",
      "",
      "Name the IDEAS they have not got, not the questions they missed. 'Question 3 was wrong'",
      "cannot be taught; 'they think the bottom number counts the pieces you have taken' can.",
      "",
      "At most three, and fewer is better — one thing fixed properly beats three half-fixed. If",
      "several wrong answers come from the same misunderstanding, that is ONE gap, not three.",
      "",
      "'misunderstanding' is what their answers show they currently believe, stated plainly. Be",
      "specific: it is the thing the next explanation has to argue against.",
      "",
      "If the wrong answers look like slips — right method, arithmetic error, misread question —",
      "say so as the misunderstanding rather than inventing a conceptual gap.",
      "",
      "UK English. No markdown.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Lesson: ${attempt.lesson.title} (${attempt.lesson.unit.programme.subject.title})`,
          attempt.lesson.pupilOutcome ? `Meant to be able to: ${attempt.lesson.pupilOutcome}` : "",
          "",
          "What they got wrong:",
          ...wrong.map(
            (w) =>
              `- Question: ${w.question.prompt}\n  They answered: ${JSON.stringify(w.response)}` +
              (Array.isArray(w.misconceptions) && w.misconceptions.length > 0
                ? `\n  Noted at marking: ${(w.misconceptions as string[]).join("; ")}`
                : ""),
          ),
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const created: UnderstandingGap[] = [];
  for (const gap of data.gaps) {
    const row = await prisma.understandingGap
      .create({
        data: {
          studentId,
          lessonId: attempt.lessonId,
          lessonAttemptId,
          concept: gap.concept,
          misunderstanding: gap.misunderstanding,
        },
      })
      .catch(() => null);
    if (row) created.push(row);
  }
  return created;
}

// ───────────────────────────── re-teaching ─────────────────────────────

export const reteachSchema = z.object({
  /** Two to six short paragraphs, spoken. */
  explanation: z.string(),
  /** One question to see whether it landed. Short answer, marked by the tutor. */
  checkQuestion: z.string(),
  /** What a good answer to that would show. Not wording — understanding. */
  checkLooksLike: z.string(),
});

export type Reteach = z.infer<typeof reteachSchema> & { strategy: TeachingStrategy };

function asStrategies(value: unknown): TeachingStrategy[] {
  return Array.isArray(value)
    ? value.filter((v): v is TeachingStrategy => STRATEGY_ORDER.includes(v as TeachingStrategy))
    : [];
}

/** The next strategy not yet used, or null when every approach has been tried. */
export function nextStrategy(tried: TeachingStrategy[]): TeachingStrategy | null {
  return STRATEGY_ORDER.find((s) => !tried.includes(s)) ?? null;
}

/**
 * Explains the gap again, a different way.
 *
 * Returns null when every strategy has been spent — at which point grinding on is not tutoring,
 * it is punishment, and the honest thing is to park it for another day.
 */
export async function reteach(gapId: string, studentId: string): Promise<Reteach | null> {
  const gap = await prisma.understandingGap.findFirst({
    where: { id: gapId, studentId },
    include: { lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } } },
  });
  if (!gap) return null;

  const tried = asStrategies(gap.strategiesTried);
  const strategy = nextStrategy(tried);
  if (!strategy) return null;

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: { select: { displayName: true } } },
  });
  const interests = Array.isArray(student?.interests)
    ? (student.interests as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "strong",
    schemaName: "reteach",
    schema: reteachSchema,
    system: [
      `You are tutoring ${student?.user.displayName ?? "a child"}, aged ${student?.age ?? "about " + (5 + (student?.yearGroup ?? 7))}, one to one.`,
      "",
      "They have already had this explained once and it did not land. Do NOT say it again the",
      "same way — that is the single most useless thing a tutor can do, and they will hear it as",
      "'you are not listening'.",
      "",
      `This time: ${STRATEGY_BRIEF[strategy]}`,
      "",
      tried.length > 0
        ? `Already tried and did not work: ${tried.join(", ")}. Do not fall back into those.`
        : "",
      interests.length > 0
        ? `They are into ${interests.join(", ")} — use that if it genuinely fits, and leave it alone if it does not.`
        : "",
      "",
      "Rules:",
      "- Talk to them, not about the topic. Short sentences. Warm, never disappointed.",
      "- Never open by naming what they got wrong. Open with the thing itself.",
      "- Address the specific wrong belief below. A general re-explanation misses the point.",
      "- End with one question that would show whether it landed — answerable in a sentence or",
      "  two, and not a repeat of the question they already failed.",
      "- 'checkLooksLike' describes what a good answer demonstrates they understand, in terms of",
      "  meaning rather than particular words. A child who says it their own way is right.",
      "- UK English, plain prose, no markdown, no bullet points — this gets read aloud.",
    ]
      .filter(Boolean)
      .join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Subject: ${gap.lesson.unit.programme.subject.title}, Year ${gap.lesson.unit.programme.yearGroup}`,
          `Lesson: ${gap.lesson.title}`,
          `What they have not understood: ${gap.concept}`,
          `What they currently believe instead: ${gap.misunderstanding}`,
          gap.lastExplainBack ? `\nLast time they tried to explain it, they said: "${gap.lastExplainBack}"` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  await prisma.understandingGap.update({
    where: { id: gap.id },
    data: {
      round: { increment: 1 },
      strategiesTried: [...tried, strategy],
      lastExplanation: { ...data, strategy },
    },
  });

  return { ...data, strategy };
}

// ───────────────────────────── explaining it back ─────────────────────────────

export const judgeSchema = z.object({
  /** True only when their own words show the idea, not when they echo yours. */
  understood: z.boolean(),
  /** Said to the child. Warm, specific, never "wrong". */
  feedback: z.string(),
  /** When not understood: the bit still missing, for the next round to aim at. */
  stillMissing: z.string().nullable(),
});

export type ExplainBackVerdict = z.infer<typeof judgeSchema>;

/**
 * Judges a child explaining the idea back in their own words.
 *
 * This is the test that cannot be passed by pattern-matching, which is exactly why it is the
 * one that closes a gap. Being generous is the right failure mode: a child who has the idea but
 * expresses it clumsily has understood it, and telling them otherwise teaches them that the
 * words matter more than the meaning.
 */
export async function judgeExplainBack(
  gapId: string,
  studentId: string,
  theirWords: string,
): Promise<ExplainBackVerdict | null> {
  const gap = await prisma.understandingGap.findFirst({
    where: { id: gapId, studentId },
    include: { lesson: { select: { title: true } } },
  });
  if (!gap) return null;

  const explanation = gap.lastExplanation as { checkQuestion?: string; checkLooksLike?: string } | null;

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "strong",
    schemaName: "explain_back",
    schema: judgeSchema,
    system: [
      "A child has just explained an idea back in their own words. Decide whether they have",
      "understood it.",
      "",
      "Be generous about wording and strict about meaning. A child who has the idea but says it",
      "clumsily has understood it — marking that wrong teaches them that the words matter more",
      "than the thinking, which is the opposite of what we want. A child who has repeated your",
      "phrases back without the idea behind them has not, however neat it sounds.",
      "",
      "If they have not got it, 'stillMissing' names the one piece to aim the next explanation",
      "at — not everything that was absent, the piece that would unlock the rest.",
      "",
      "'feedback' is said straight to the child. Warm and specific. Name the part they DID get,",
      "even when the verdict is no — there is almost always one. Never 'wrong', never 'incorrect'.",
      "",
      "UK English, two or three sentences, no markdown.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `The idea: ${gap.concept}`,
          `What they used to believe: ${gap.misunderstanding}`,
          explanation?.checkQuestion ? `They were asked: ${explanation.checkQuestion}` : "",
          explanation?.checkLooksLike ? `A good answer shows: ${explanation.checkLooksLike}` : "",
          "",
          `They said: "${theirWords}"`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  await prisma.understandingGap.update({
    where: { id: gap.id },
    data: {
      lastExplainBack: theirWords,
      ...(data.understood
        ? { status: "UNDERSTOOD" as const, closedAt: new Date() }
        : { misunderstanding: data.stillMissing ?? gap.misunderstanding }),
    },
  });

  return data;
}

/**
 * Parks what is still open when the period ends.
 *
 * Not written off — parked. It comes back as review on another day, and it never counts as
 * understood. A tutor who runs out of time says "we'll pick this up tomorrow", not "fine".
 */
export async function parkOpenGaps(lessonAttemptId: string, studentId: string): Promise<number> {
  const open = await prisma.understandingGap.findMany({
    where: { lessonAttemptId, studentId, status: "OPEN" },
  });
  if (open.length === 0) return 0;

  await prisma.understandingGap.updateMany({
    where: { id: { in: open.map((g) => g.id) } },
    data: { status: "PARKED", closedAt: new Date() },
  });

  // Back on the timetable rather than lost. Tomorrow, so it is still fresh.
  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  for (const gap of open) {
    await prisma.reviewItem
      .create({
        data: {
          studentId,
          lessonId: gap.lessonId,
          reason: "MISCONCEPTION",
          detail: `${gap.concept} — ${gap.misunderstanding}`,
          dueAt,
        },
      })
      .catch(() => undefined);
  }
  return open.length;
}

/** Everything still open for this attempt. The lesson is not understood while this is non-empty. */
export async function openGaps(lessonAttemptId: string, studentId: string): Promise<UnderstandingGap[]> {
  return prisma.understandingGap.findMany({
    where: { lessonAttemptId, studentId, status: "OPEN" },
    orderBy: { openedAt: "asc" },
  });
}
