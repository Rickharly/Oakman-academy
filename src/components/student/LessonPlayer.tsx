"use client";

import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, FileText, Loader2, Lock, MessageCircle, PartyPopper, Sparkles } from "lucide-react";
import type { LessonStage } from "@/generated/prisma/client";
import { nextStage, stageIndex } from "@/lib/lessons/stages";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { QuestionRenderer } from "@/components/student/questions/QuestionRenderer";
import type { QuestionResult, StudentQuestionLite } from "@/components/student/questions/types";
import { TeacherPanel, type TeacherView } from "@/components/student/TeacherPanel";
import { subjectTheme } from "@/components/student/subjectTheme";
import { SubjectArt } from "@/components/student/SubjectArt";
import { LessonTimer } from "@/components/student/LessonTimer";
import { BreakTimer } from "@/components/student/BreakTimer";
import { ReadAloud } from "@/components/student/ReadAloud";
import { UnderstandingLoop } from "@/components/student/UnderstandingLoop";
import { formatMinutes } from "@/components/student/format";
import type { LessonExplainer } from "@/lib/lessons/explainer";
import { cn } from "@/lib/cn";

/**
 * The written lesson as the teacher would say it, in order.
 *
 * Headings are spoken too — they are how a listener knows a new idea has started, which is the
 * job the bold text does for a reader.
 */
function explainerSpeech(explainer: LessonExplainer): string[] {
  const parts: string[] = [explainer.intro];
  for (const section of explainer.sections) {
    parts.push(`${section.heading}. ${section.body}`);
  }
  if (explainer.workedExample) {
    parts.push(
      [
        "Let's do one together.",
        explainer.workedExample.question,
        ...explainer.workedExample.steps.map((step, i) => `Step ${i + 1}. ${step}`),
        `So the answer is ${explainer.workedExample.answer}.`,
      ].join(" "),
    );
  }
  if (explainer.watchOutFor) parts.push(`Watch out for this. ${explainer.watchOutFor}`);
  parts.push(`Before you go on. ${explainer.thinkAbout}`);
  return parts;
}

/**
 * Whether a resource points at something that can actually be fetched.
 *
 * The bundled placeholder curriculum lists its videos as `fixture://…`, which is not an address
 * — nothing can fetch it, and the failure is "unknown scheme" deep inside a stream. Treating
 * those rows as a video gave a child a black player stuck at 0:00 on every lesson, which looks
 * exactly like a real video failing to load. That is why "the video is broken" was the story
 * for days when the truth was that there was no video.
 *
 * A stored file is fine. An http(s) address is fine. A path with no scheme is fine — the server
 * resolves it against the provider's base. Anything else is a placeholder pretending.
 */
function isPlayable(resource: LessonPlayerResource): boolean {
  if (resource.storedPath) return true;
  const url = resource.providerUrl;
  if (!url) return false;
  if (/^https?:\/\//i.test(url)) return true;
  return !url.includes("://");
}

// ───────────────────────────── props ─────────────────────────────

export type LessonPlayerResource = {
  id: string;
  type: string;
  label: string;
  providerUrl: string | null;
  storedPath: string | null;
};

export type LessonPlayerQuestion = StudentQuestionLite & { stage: "STARTER" | "PRACTICE" | "CHECK" };

export type LessonPlayerQuestionAttempt = {
  questionId: string;
  attemptNumber: number;
  gradedBy: "PENDING" | "DETERMINISTIC" | "AI" | "PARENT";
  isCorrect: boolean | null;
  score: number | null;
  maxScore: number;
  feedback: string | null;
};

export type LessonPlayerActivity = {
  stage: "STARTER" | "PRACTICE" | "CHECK";
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  questionAttempts: LessonPlayerQuestionAttempt[];
};

export type LessonPlayerProps = {
  attemptId: string;
  currentStage: LessonStage;
  lesson: {
    id: string;
    title: string;
    keyLearningPoints: string[];
    keywords: { keyword: string; description: string }[];
    transcript: string | null;
    estimatedMinutes: number;
    /** The lesson taught in words — null until it has been written for this lesson. */
    explainer?: LessonExplainer | null;
    /** The lesson on Oak National Academy's own site — used when we have no video file. */
    oakUrl?: string | null;
    /** Whether Oak's headers permit their page being shown inside ours. */
    oakEmbeddable?: boolean;
    resources: LessonPlayerResource[];
  };
  subjectTitle: string;
  subjectSlug: string;
  unitTitle: string;
  questionsByStage: Record<"STARTER" | "PRACTICE" | "CHECK", LessonPlayerQuestion[]>;
  activities: LessonPlayerActivity[];
  drafts: Record<string, unknown>;
  worksheetFallback: LessonPlayerResource | null;
  feedbackSummary: string | null;
  masteryScore: number | null;
  nextLessonId: string | null;
  /** Length of a period, in minutes, from the student's timetable. */
  lessonMinutes: number;
  /** Length of the break between periods, in minutes. */
  breakMinutes: number;
  /** Seconds already spent in this lesson. */
  elapsedSeconds: number;
  /** Whether the teacher reads her replies aloud for this child. */
  voiceEnabled?: boolean;
  /**
   * Whether to offer the "do you already know this?" check first. Only for a lesson not yet
   * started — asking someone mid-lesson whether they need it makes no sense.
   */
  offerPreCheck?: boolean;
};

type FinalAttempt = {
  status: "IN_PROGRESS" | "COMPLETED" | "NEEDS_REVIEW" | "MASTERED";
  score: number | null;
  maxScore: number | null;
  masteryScore: number | null;
};

const RAIL_STAGES: { stage: LessonStage; label: string }[] = [
  { stage: "STARTER", label: "Starter" },
  { stage: "LEARN", label: "Learn" },
  { stage: "PRACTICE", label: "Practice" },
  { stage: "CHECK", label: "Check" },
  { stage: "FEEDBACK", label: "Feedback" },
];

// ───────────────────────────── helpers ─────────────────────────────

/**
 * Debounce timers for draft auto-save, keyed by `${attemptId}:${questionId}`.
 * Deliberately module-scope (not a ref/state) — it's not part of any
 * component's render output, so mutating it from an event handler that's
 * passed down as a prop is safe and doesn't trip the "no ref reads during
 * render" lint rule.
 */
const draftSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function pickLatest(activities: LessonPlayerActivity[], stage: "STARTER" | "PRACTICE" | "CHECK") {
  const filtered = activities.filter((a) => a.stage === stage);
  return filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
}

function buildInitialResults(activities: LessonPlayerActivity[]): Record<string, QuestionResult> {
  const latest = new Map<string, LessonPlayerQuestionAttempt>();
  for (const activity of activities) {
    for (const qa of activity.questionAttempts) {
      const prev = latest.get(qa.questionId);
      if (!prev || qa.attemptNumber > prev.attemptNumber) latest.set(qa.questionId, qa);
    }
  }
  const map: Record<string, QuestionResult> = {};
  for (const [questionId, qa] of latest) {
    if (qa.gradedBy === "PENDING") continue;
    map[questionId] = { isCorrect: qa.isCorrect, score: qa.score, maxScore: qa.maxScore, feedback: qa.feedback };
  }
  return map;
}

function buildCheckAttemptCounts(activities: LessonPlayerActivity[]): Record<string, number> {
  const checkActivity = pickLatest(activities, "CHECK");
  const counts: Record<string, number> = {};
  if (!checkActivity) return counts;
  for (const qa of checkActivity.questionAttempts) {
    if (qa.gradedBy === "PENDING") continue;
    counts[qa.questionId] = (counts[qa.questionId] ?? 0) + 1;
  }
  return counts;
}

async function extractError(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
  } catch {
    // not JSON — fall through to the default message
  }
  return "Something went wrong. Please try again.";
}

function scorePct(score: { score: number | null; maxScore: number | null } | undefined): number | null {
  if (!score || !score.maxScore || score.maxScore <= 0) return null;
  return Math.round(((score.score ?? 0) / score.maxScore) * 100);
}

// ───────────────────────────── component ─────────────────────────────

export function LessonPlayer(props: LessonPlayerProps) {
  const {
    attemptId,
    lesson,
    subjectTitle,
    subjectSlug,
    unitTitle,
    questionsByStage,
    worksheetFallback,
    nextLessonId,
    lessonMinutes,
    breakMinutes,
    elapsedSeconds,
    offerPreCheck = false,
    voiceEnabled = false,
  } =
    props;

  const [currentStage, setCurrentStage] = useState<LessonStage>(props.currentStage);
  const [viewStage, setViewStage] = useState<LessonStage>(props.currentStage);
  const [drafts, setDrafts] = useState<Record<string, unknown>>(props.drafts);
  const [results, setResults] = useState<Record<string, QuestionResult>>(() => buildInitialResults(props.activities));
  const [activityScore, setActivityScore] = useState<
    Record<"STARTER" | "PRACTICE" | "CHECK", { score: number | null; maxScore: number | null; percentage: number | null } | undefined>
  >(() => ({
    STARTER: pickLatest(props.activities, "STARTER"),
    PRACTICE: pickLatest(props.activities, "PRACTICE"),
    CHECK: pickLatest(props.activities, "CHECK"),
  }));
  const [submittedStage, setSubmittedStage] = useState<Record<"STARTER" | "PRACTICE" | "CHECK", boolean>>(() => ({
    STARTER: pickLatest(props.activities, "STARTER")?.status === "GRADED",
    PRACTICE: pickLatest(props.activities, "PRACTICE")?.status === "GRADED",
    CHECK: pickLatest(props.activities, "CHECK")?.status === "GRADED",
  }));
  const [checkAttemptCounts, setCheckAttemptCounts] = useState<Record<string, number>>(() =>
    buildCheckAttemptCounts(props.activities)
  );
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [finalAttempt, setFinalAttempt] = useState<FinalAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | undefined>(undefined);
  const [teacherSheetOpen, setTeacherSheetOpen] = useState(false);

  const lastVideoSent = useRef(0);
  const [generatingPractice, setGeneratingPractice] = useState(false);
  // The "do you already know this?" check, offered once before a lesson is started.
  const [preCheckOpen, setPreCheckOpen] = useState(offerPreCheck);
  const [preCheckAnswers, setPreCheckAnswers] = useState<Record<string, unknown>>({});
  const [preCheckBusy, setPreCheckBusy] = useState(false);
  const [preCheckResult, setPreCheckResult] = useState<{ passed: boolean; message: string } | null>(null);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  // A video that will not load renders a player stuck at 0:00, which is indistinguishable from
  // "this lesson has no video" and leaves a child staring at a black rectangle. When it fails,
  // say so and give them the way through.
  const [videoFailed, setVideoFailed] = useState(false);
  // Set when the tutoring loop reports nothing left open, so the lesson stops holding them.
  const [gapsClosed, setGapsClosed] = useState(false);
  // The lesson taught in words. Present on the page when it has been written before; asked for
  // on first arrival otherwise. A lesson that arrives without a video is otherwise a bullet
  // list and a quiz, which is how a child ends up tested on decibels they have never met.
  const [explainer, setExplainer] = useState<LessonExplainer | null>(lesson.explainer ?? null);
  const [explainerState, setExplainerState] = useState<"idle" | "loading" | "none" | "failed">("idle");

  // Written the first time anyone reaches this lesson, then stored — so this fires once per
  // lesson across the whole family, not once per child per visit.
  // A ref, not state: this guards against the effect firing twice (Strict Mode, a re-render
  // mid-request) without itself causing a render.
  const explainerAsked = useRef(false);
  useEffect(() => {
    if (explainer || viewStage !== "LEARN" || explainerAsked.current) return;
    explainerAsked.current = true;
    let cancelled = false;
    // A hard stop. Writing a lesson takes twenty seconds or so; a minute means something has
    // gone wrong upstream, and a child should be told that rather than left watching a spinner
    // for as long as the request feels like taking.
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 60_000);
    void (async () => {
      setExplainerState("loading");
      try {
        const res = await fetch(`/api/lessons/${lesson.id}/explainer`, {
          method: "POST",
          signal: abort.signal,
        });
        const data = (await res.json()) as { explainer?: LessonExplainer | null };
        if (cancelled) return;
        if (!res.ok) {
          setExplainerState("failed");
          return;
        }
        // Null is an answer: this lesson has nothing to teach from. Saying so is better than
        // a spinner that never stops.
        if (!data.explainer) {
          setExplainerState("none");
          return;
        }
        setExplainer(data.explainer);
        setExplainerState("idle");
      } catch {
        if (!cancelled) setExplainerState("failed");
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [explainer, lesson.id, viewStage]);
  const [extraPractice, setExtraPractice] = useState<LessonPlayerQuestion[]>([]);
  const [extraDrafts, setExtraDrafts] = useState<Record<string, unknown>>({});
  const [extraResults, setExtraResults] = useState<Record<string, QuestionResult>>({});
  const [extraSubmitted, setExtraSubmitted] = useState(false);
  const [retryError, setRetryError] = useState<Record<string, string>>({});
  // The period clock, ticking. `elapsedSeconds` is only the value at page load, so anything
  // that asks "how much of the lesson is left" has to keep counting.
  const [spentSeconds, setSpentSeconds] = useState(elapsedSeconds);
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setSpentSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const theme = subjectTheme(subjectSlug);

  // ── drafts ──
  async function saveDraft(questionId: string, response: unknown): Promise<void> {
    try {
      await fetch(`/api/attempts/${attemptId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, response }),
      });
    } catch {
      // best-effort — flushed again before the stage is submitted
    }
  }

  function updateDraft(questionId: string, value: unknown) {
    setDrafts((prev) => ({ ...prev, [questionId]: value }));
    const key = `${attemptId}:${questionId}`;
    const existing = draftSaveTimers.get(key);
    if (existing) clearTimeout(existing);
    draftSaveTimers.set(
      key,
      setTimeout(() => void saveDraft(questionId, value), 600)
    );
  }

  async function flushDrafts(questionIds: string[]): Promise<void> {
    await Promise.all(
      questionIds.map((id) => {
        const key = `${attemptId}:${id}`;
        const existing = draftSaveTimers.get(key);
        if (existing) {
          clearTimeout(existing);
          draftSaveTimers.delete(key);
        }
        return drafts[id] !== undefined ? saveDraft(id, drafts[id]) : Promise.resolve();
      })
    );
  }

  // ── graded stage submit (STARTER / PRACTICE / CHECK) ──
  async function submitGraded(stage: "STARTER" | "PRACTICE" | "CHECK") {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await flushDrafts(questionsByStage[stage].map((q) => q.id));

      const res = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      const data: {
        activity: { score: number | null; maxScore: number | null; percentage: number | null };
        results: { questionId: string; isCorrect: boolean | null; score: number | null; maxScore: number; feedback: string | null; question?: { answerKey?: unknown } }[];
      } = await res.json();

      setResults((prev) => {
        const next = { ...prev };
        for (const r of data.results) {
          next[r.questionId] = {
            isCorrect: r.isCorrect,
            score: r.score,
            maxScore: r.maxScore,
            feedback: r.feedback,
            answerKey: r.question?.answerKey,
          };
        }
        return next;
      });
      setActivityScore((prev) => ({ ...prev, [stage]: data.activity }));
      setSubmittedStage((prev) => ({ ...prev, [stage]: true }));

      const wasCurrent = currentStage === stage;
      const emptyStage = questionsByStage[stage].length === 0;
      if (wasCurrent) {
        const next = nextStage(stage);
        if (next) {
          setCurrentStage(next);
          if (stage === "CHECK" || emptyStage) setViewStage(next);
        }
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── LEARN ──
  async function completeLearn() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "LEARN", action: "complete" }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      setCurrentStage("PRACTICE");
      setViewStage("PRACTICE");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleVideoTimeUpdate(e: SyntheticEvent<HTMLVideoElement>) {
    const el = e.currentTarget;
    if (!el.duration || Number.isNaN(el.duration)) return;
    const now = Date.now();
    if (now - lastVideoSent.current < 4000) return;
    lastVideoSent.current = now;
    const percentWatched = Math.min(100, (el.currentTime / el.duration) * 100);
    void fetch(`/api/attempts/${attemptId}/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentWatched, positionSeconds: el.currentTime, completed: percentWatched >= 90 }),
    }).catch(() => undefined);
  }

  function handleVideoEnded(e: SyntheticEvent<HTMLVideoElement>) {
    const el = e.currentTarget;
    void fetch(`/api/attempts/${attemptId}/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentWatched: 100, positionSeconds: el.duration || 0, completed: true }),
    }).catch(() => undefined);
  }

  // ── CHECK retries (shown on FEEDBACK) ──
  async function startRetry(questionId: string) {
    setSubmitError(null);
    setRetryError((prev) => ({ ...prev, [questionId]: "" }));
    try {
      const res = await fetch(`/api/attempts/${attemptId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      setRetryingIds((prev) => new Set(prev).add(questionId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setRetryError((prev) => ({ ...prev, [questionId]: message }));
    }
  }

  async function submitRetries() {
    const ids = new Set(retryingIds);
    await submitGraded("CHECK");
    setCheckAttemptCounts((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = (next[id] ?? 0) + 1;
      });
      return next;
    });
    setRetryingIds(new Set());
  }

  // ── FEEDBACK → COMPLETE ──
  async function finishLesson() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r1 = await fetch(`/api/attempts/${attemptId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "FEEDBACK", action: "complete" }),
      });
      if (!r1.ok) throw new Error(await extractError(r1));

      const r2 = await fetch(`/api/attempts/${attemptId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "COMPLETE", action: "complete" }),
      });
      if (!r2.ok) throw new Error(await extractError(r2));
      const data: { attempt: FinalAttempt } = await r2.json();

      setFinalAttempt(data.attempt);
      setCurrentStage("COMPLETE");
      setViewStage("COMPLETE");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function selectStage(stage: LessonStage) {
    if (stageIndex(stage) > stageIndex(currentStage)) return;
    setViewStage(stage);
  }

  // ── derived ──
  const checkScore = activityScore.CHECK;
  const practiceScore = activityScore.PRACTICE;
  const checkPct = checkScore?.maxScore ? (checkScore.score ?? 0) / checkScore.maxScore : null;
  const practicePct = practiceScore?.maxScore ? (practiceScore.score ?? 0) / practiceScore.maxScore : null;
  const masteryEstimate =
    checkPct == null ? props.masteryScore : practicePct != null ? 0.8 * checkPct + 0.2 * practicePct : checkPct;

  const currentQuestionId =
    focusedQuestionId ??
    (viewStage === "STARTER" || viewStage === "PRACTICE" || viewStage === "CHECK"
      ? questionsByStage[viewStage]?.[0]?.id
      : undefined);

  /**
   * What the child can see, described for the teacher.
   *
   * Without this she knows the lesson but not the screen, so "I don't get it" makes her ask
   * which part they mean when the answer is right in front of both of them. It also tells her
   * that the question they are staring at is unanswered, which is what stops her answering it.
   */
  const teacherView: TeacherView = (() => {
    const onScreenQuestions =
      viewStage === "PRACTICE" && extraPractice.length > 0
        ? extraPractice
        : viewStage === "STARTER" || viewStage === "PRACTICE" || viewStage === "CHECK"
          ? questionsByStage[viewStage]
          : [];
    const question =
      onScreenQuestions.find((q) => q.id === currentQuestionId) ?? onScreenQuestions[0];

    if (!question) {
      const section =
        viewStage === "LEARN"
          ? lesson.resources.some((r) => r.type === "VIDEO" && (r.providerUrl || r.storedPath))
            ? "the lesson video, with the written lesson, key points and keywords below it"
            : explainer
              ? "the lesson written out — intro, the taught sections, a worked example"
              : "the key points and keywords for this lesson"
          : viewStage === "FEEDBACK"
            ? "their marks and feedback for the quiz"
            : viewStage === "COMPLETE"
              ? "the end-of-lesson screen"
              : "the lesson page";
      return { stage: viewStage, section };
    }

    const index = onScreenQuestions.findIndex((q) => q.id === question.id);
    // Whether this question has a picture, and what it shows. Without this the teacher was
    // answering "I can't do this one" about a question she thought was pure text, so she could
    // not say "look at the table — the heading above the 100s column".
    const picture = (question.promptImage as { alt?: string } | null | undefined)?.alt;
    const isExtra = viewStage === "PRACTICE" && extraPractice.length > 0;
    const result = isExtra ? extraResults[question.id] : results[question.id];
    const draft = isExtra ? extraDrafts[question.id] : drafts[question.id];
    const choices = (question.options as { choices?: { text?: string }[] } | null)?.choices;

    return {
      stage: viewStage,
      section:
        `question ${index + 1} of ${onScreenQuestions.length}${isExtra ? " in their extra practice" : ""}` +
        (question.promptImage
          ? `, which has a picture with it${picture ? ` showing: ${picture}` : ""}`
          : ""),
      questionPrompt: question.prompt,
      options: Array.isArray(choices)
        ? choices.map((c) => String(c?.text ?? "")).filter(Boolean).slice(0, 8)
        : undefined,
      // Unanswered is the fact that changes what she is allowed to say, so it is derived from
      // whether the answer has actually been marked — not from which tab is open.
      unanswered: !result,
      draft: typeof draft === "string" && draft.trim() ? draft.slice(0, 600) : undefined,
    };
  })();

  // ───────────────────────────── stage renderers ─────────────────────────────

  function renderQuizStage(stage: "STARTER" | "PRACTICE" | "CHECK") {
    const qs =
      stage === "PRACTICE" && questionsByStage.PRACTICE.length === 0
        ? extraPractice
        : questionsByStage[stage];
    const submitted = submittedStage[stage];

    if (qs.length === 0) {
      return (
        <Card padding="lg" className="space-y-4 text-center">
          <p className="text-ink-muted">Nothing to answer for this step.</p>
          {!submitted ? (
            <Button onClick={() => void submitGraded(stage)} disabled={submitting}>
              {submitting ? "Continuing…" : "Continue"}
            </Button>
          ) : null}
        </Card>
      );
    }

    return (
      <div className="space-y-5">
        {qs.map((q, i) => (
          <Card
            key={q.id}
            padding="lg"
            onFocusCapture={() => setFocusedQuestionId(q.id)}
            onClickCapture={() => setFocusedQuestionId(q.id)}
          >
            <p className="mb-3 text-xs font-medium text-ink-faint">
              Question {i + 1} of {qs.length} · {q.maxScore} {q.maxScore === 1 ? "mark" : "marks"}
            </p>
            <p className="mb-4 text-base font-medium text-ink">{q.prompt}</p>
            <QuestionRenderer
              question={q}
              value={drafts[q.id]}
              onChange={(v) => updateDraft(q.id, v)}
              disabled={submitted}
              result={results[q.id]}
            />
            {submitted && results[q.id]?.feedback ? (
              <p className={cn("mt-3 text-sm", results[q.id]?.isCorrect ? "text-success" : "text-ink-muted")}>
                {results[q.id]?.feedback}
              </p>
            ) : null}
          </Card>
        ))}

        {!submitted ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void submitGraded(stage)} disabled={submitting}>
                {submitting ? "Checking…" : "Submit"}
              </Button>
              {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
            </div>
            {submitting ? (
              <div className="flex items-center gap-2.5 rounded-2xl bg-accent-soft px-4 py-3">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                <p className="text-sm text-accent-ink">
                  Your teacher is reading your answers. Written answers take a few seconds — she
                  reads them properly rather than just looking for keywords.
                </p>
              </div>
            ) : null}
          </div>
        ) : stage !== "CHECK" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-ink">
              {activityScore[stage]?.score ?? 0} / {activityScore[stage]?.maxScore ?? 0}
            </p>
            <Button onClick={() => setViewStage(currentStage)}>
              Continue to {stage === "STARTER" ? "Learn" : "Check"}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  /** Asks the teacher to turn a worksheet-only lesson into questions they can do here. */
  async function generatePractice() {
    if (generatingPractice) return;
    setGeneratingPractice(true);
    setPracticeError(null);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/practice`, { method: "POST" });
      const data = (await res.json()) as { questions?: LessonPlayerQuestion[]; error?: string };
      if (!res.ok || !data.questions?.length) {
        throw new Error(data.error ?? "Couldn't write the questions. Try again in a moment.");
      }
      setExtraPractice(data.questions);
    } catch (err) {
      setPracticeError(err instanceof Error ? err.message : "Couldn't write the questions.");
    } finally {
      setGeneratingPractice(false);
    }
  }

  /** More work on the same topic, for a child who finished the period with time to spare. */
  async function practiseMore() {
    if (generatingPractice) return;
    setGeneratingPractice(true);
    setPracticeError(null);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension: true }),
      });
      const data = (await res.json()) as { questions?: LessonPlayerQuestion[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't write the questions. Try again in a moment.");
      if (!data.questions?.length) {
        // Not an error: there is genuinely nothing more to set. Say so, and leave the Finish
        // button below as the obvious next thing rather than a red message and a dead end.
        setPracticeError(
          "I haven't got more questions on this one right now. Finish the lesson below when you're ready.",
        );
        return;
      }
      startExtraRound(data.questions);
    } catch (err) {
      setPracticeError(
        err instanceof Error
          ? `${err.message} You can finish the lesson below if you'd rather stop.`
          : "Couldn't write the questions. You can finish the lesson below.",
      );
    } finally {
      setGeneratingPractice(false);
    }
  }

  /** Puts a new set of extra questions on screen, cleared of any previous round. */
  function startExtraRound(questions: LessonPlayerQuestion[]) {
    setExtraPractice(questions);
    setExtraDrafts({});
    setExtraResults({});
    setExtraSubmitted(false);
    setViewStage("PRACTICE");
  }

  /** Marks the extra questions. Graded on their own, never mixed into the lesson's scores. */
  async function submitExtra() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/practice/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answers: extraDrafts }),
      });
      const data = (await res.json()) as {
        results?: { questionId: string; isCorrect: boolean; feedback: string | null }[];
        error?: string;
      };
      if (!res.ok || !data.results) throw new Error(data.error ?? "Could not mark that.");

      const next: Record<string, QuestionResult> = {};
      for (const r of data.results) {
        next[r.questionId] = { isCorrect: r.isCorrect, feedback: r.feedback ?? undefined } as QuestionResult;
      }
      setExtraResults(next);
      setExtraSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not mark that.");
    } finally {
      setSubmitting(false);
    }
  }

  /** Practice aimed at the questions they actually got wrong, not the same quiz again. */
  async function practiseWeakSpots() {
    if (generatingPractice) return;
    setGeneratingPractice(true);
    setPracticeError(null);
    try {
      const missed = questionsByStage.CHECK.filter((q) => results[q.id]?.isCorrect === false).map(
        (q) => q.prompt,
      );
      const res = await fetch(`/api/lessons/${lesson.id}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missedPrompts: missed }),
      });
      const data = (await res.json()) as { questions?: LessonPlayerQuestion[]; error?: string };
      if (!res.ok || !data.questions?.length) {
        throw new Error(data.error ?? "Couldn't write the questions. Try again in a moment.");
      }
      startExtraRound(data.questions);
    } catch (err) {
      setPracticeError(err instanceof Error ? err.message : "Couldn't write the questions.");
    } finally {
      setGeneratingPractice(false);
    }
  }

  /** The extra round: its own questions, its own marking, its own Submit. */
  function renderExtraPractice() {
    return (
      <div className="space-y-5">
        <Card padding="lg" className="space-y-1 bg-accent-soft">
          <h2 className="text-base font-semibold text-ink">More practice on this topic</h2>
          <p className="text-sm text-ink-muted">
            These don&apos;t change your lesson score — they are here so the idea sticks.
          </p>
        </Card>

        {extraPractice.map((q, i) => (
          <Card key={q.id} padding="lg">
            <p className="mb-3 text-xs font-medium text-ink-faint">
              Question {i + 1} of {extraPractice.length}
            </p>
            <p className="mb-4 text-base font-medium text-ink">{q.prompt}</p>
            <QuestionRenderer
              question={q}
              value={extraDrafts[q.id]}
              onChange={(v) => setExtraDrafts((prev) => ({ ...prev, [q.id]: v }))}
              disabled={extraSubmitted}
              result={extraResults[q.id]}
            />
            {extraSubmitted && extraResults[q.id]?.feedback ? (
              <p
                className={cn(
                  "mt-3 text-sm",
                  extraResults[q.id]?.isCorrect ? "text-success" : "text-ink-muted",
                )}
              >
                {extraResults[q.id]?.feedback}
              </p>
            ) : null}
          </Card>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          {!extraSubmitted ? (
            <Button
              onClick={() => void submitExtra()}
              disabled={submitting || Object.keys(extraDrafts).length === 0}
            >
              {submitting ? "Checking…" : "Submit"}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => void practiseMore()} disabled={generatingPractice}>
                {generatingPractice ? "Writing more…" : "More like these"}
              </Button>
              <Button variant="ghost" onClick={() => setViewStage("FEEDBACK")}>
                Back to my feedback
              </Button>
            </>
          )}
          {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
        </div>
      </div>
    );
  }

  function renderPractice() {
    // An extra round takes over the practice slot while it is live: it has its own questions
    // and its own marking, and mixing it into the lesson's practice was why it did nothing.
    if (extraPractice.length > 0) return renderExtraPractice();
    const qs = questionsByStage.PRACTICE;
    const submitted = submittedStage.PRACTICE;
    const worksheetUrl = worksheetFallback
      ? (worksheetFallback.storedPath ?? `/api/curriculum/resources/${worksheetFallback.id}`)
      : null;

    // Some Oak lessons ship their practice as a worksheet PDF. A PDF cannot be marked and
    // teaches us nothing about what they got wrong, so the teacher writes practice from the
    // lesson instead and the worksheet stays as an optional extra.
    if (qs.length === 0) {
      return (
        <Card padding="lg" className="space-y-4">
          {generatingPractice ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <p className="text-ink">Your teacher is writing your practice questions…</p>
            </div>
          ) : (
            <>
              <p className="text-ink">
                This lesson came with a worksheet instead of questions. Your teacher can turn it
                into practice you can do right here.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void generatePractice()} disabled={submitting}>
                  Give me some practice
                </Button>
                {worksheetUrl ? (
                  <Button variant="secondary" href={worksheetUrl} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4" /> Open the worksheet instead
                  </Button>
                ) : lesson.oakUrl ? (
                  // No worksheet file of our own, but Oak has one on their lesson page.
                  <Button variant="secondary" href={lesson.oakUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Get the worksheet from Oak
                  </Button>
                ) : null}
                {!submitted ? (
                  <Button variant="ghost" onClick={() => void submitGraded("PRACTICE")} disabled={submitting}>
                    Skip practice
                  </Button>
                ) : null}
              </div>
            </>
          )}
          {practiceError ? <p className="text-sm text-danger">{practiceError}</p> : null}
          {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
        </Card>
      );
    }
    return renderQuizStage("PRACTICE");
  }

  function renderLearn() {
    // Served through our own route: Oak's URLs need the API key, which the browser must
    // never have. `storedPath` wins when the asset was downloaded at sync time.
    const video = lesson.resources.find((r) => r.type === "VIDEO" && isPlayable(r));
    const learnDone = stageIndex(currentStage) > stageIndex("LEARN");
    const teaching = explainerState === "loading";

    return (
      <div className="space-y-6">
        {/*
          The lesson itself, in words, above everything else.

          Key points and keywords are a teacher's notes; a child who has never met the topic
          cannot learn from them. This is the part that teaches — it comes first, and the
          Learn step cannot be marked done while it is still being written.
        */}
        {explainer ? (
          <Card padding="lg" className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                What this lesson is about
              </p>
              <p className="text-[17px] leading-relaxed text-ink">{explainer.intro}</p>
            </div>

            {/*
              A written lesson is a lot of words for a nine-year-old to get through alone. The
              teacher reads it — the whole thing, in order, pausable — so listening is a real
              way through the lesson and not a consolation prize. The words stay on screen.
            */}
            <ReadAloud parts={explainerSpeech(explainer)} />

            {explainer.sections.map((section, i) => (
              <div key={i} className="space-y-1.5">
                <h3 className="text-base font-semibold text-ink">{section.heading}</h3>
                <p className="text-[15px] leading-relaxed text-ink">{section.body}</p>
              </div>
            ))}

            {explainer.workedExample ? (
              <div className="space-y-2 rounded-2xl bg-stone-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Let&apos;s do one together
                </p>
                <p className="text-[15px] font-medium text-ink">{explainer.workedExample.question}</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink">
                  {explainer.workedExample.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                <p className="text-[15px] font-medium text-ink">
                  So the answer is {explainer.workedExample.answer}
                </p>
              </div>
            ) : null}

            {explainer.watchOutFor ? (
              <div className="rounded-2xl border border-warning/30 bg-warning-soft/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Watch out for this
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">{explainer.watchOutFor}</p>
              </div>
            ) : null}

            <div className="rounded-2xl bg-accent-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Before you go on
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{explainer.thinkAbout}</p>
              <p className="mt-2 text-sm text-ink-muted">
                Have a go at answering that in your head. If you can&apos;t, ask your teacher —
                that is exactly what she is there for.
              </p>
            </div>
          </Card>
        ) : teaching ? (
          <Card padding="lg" className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <div>
              <p className="text-ink">Getting your lesson ready — about twenty seconds.</p>
              <p className="text-sm text-ink-muted">
                This one hasn&apos;t been taught before, so I&apos;m writing it out for you. Next
                time it&apos;ll be here waiting.
              </p>
            </div>
          </Card>
        ) : explainerState === "none" && !video && !lesson.oakUrl && !lesson.transcript ? (
          // Nothing to teach from, and we will not invent a lesson. Said plainly, because a
          // child sent into a quiz on material they were never given will think it is them.
          <Card padding="lg" className="space-y-2">
            <p className="text-ink">
              This lesson hasn&apos;t got its teaching material yet, so there&apos;s nothing here
              for me to take you through.
            </p>
            <p className="text-sm text-ink-muted">
              Tell whoever set today&apos;s lessons — and don&apos;t worry about the quiz on this
              one. It isn&apos;t a fair test if you were never taught it.
            </p>
          </Card>
        ) : explainerState === "failed" ? (
          <Card padding="lg" className="space-y-3">
            <p className="text-ink">
              I couldn&apos;t write this one out just now. Read what&apos;s below, and ask your
              teacher anything you don&apos;t follow — she knows this lesson.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                explainerAsked.current = false;
                setExplainerState("idle");
              }}
            >
              Try again
            </Button>
          </Card>
        ) : null}

        <Card padding="lg" className="space-y-4">
          {video && !videoFailed ? (
            <video
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-xl bg-stone-900"
              src={video.storedPath ?? `/api/curriculum/resources/${video.id}`}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              onError={() => setVideoFailed(true)}
            />
          ) : video && videoFailed ? (
            <div className="space-y-3 rounded-2xl border border-warning/30 bg-warning-soft/40 p-5">
              <p className="text-base font-medium text-ink">
                The video won&apos;t play here right now.
              </p>
              <p className="text-sm text-ink-muted">
                Everything you need is written out below, and I can read it to you. If you&apos;d
                rather watch it, it&apos;s on Oak&apos;s own page.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setVideoFailed(false)}>
                  Try the video again
                </Button>
                {lesson.oakUrl ? (
                  <Button variant="ghost" href={lesson.oakUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Watch it on Oak
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {/*
                No video file for this lesson, so send them to Oak's own page rather than
                pretending the lesson has no teaching in it.

                Deliberately a link and not an iframe. Embedding their lesson page put a whole
                website inside the lesson — navigation, cookie banner, their menus — and it did
                not even open on the video. A page pretending to be a player is worse than a
                link that admits it is one: the child taps it, watches, and comes back.
              */}
              {lesson.oakUrl ? (
                <div className="space-y-3 rounded-2xl bg-accent-soft p-5">
                  <p className="text-base font-medium text-ink">
                    The video for this lesson is on Oak National Academy&apos;s own site.
                  </p>
                  <p className="text-sm text-ink-muted">
                    Watch it there, then come straight back to this page — your place is saved,
                    and the timer is paused while you are away.
                  </p>
                  <Button href={lesson.oakUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Watch the lesson on Oak
                  </Button>
                </div>
              ) : null}

              {lesson.transcript ? (
                <details className="rounded-xl border border-line px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-ink-muted">
                    The original lesson, word for word
                  </summary>
                  <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink">
                    {lesson.transcript
                      .split(/\n{2,}/)
                      .filter((p) => p.trim().length > 0)
                      .map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                  </div>
                </details>
              ) : null}
            </>
          )}

          {/*
            Never disabled while the lesson is being written.

            This button used to wait for the written lesson, and a child whose request was slow
            or stuck could not leave the Learn step at all — the whole lesson was held hostage
            by one call to a model. Encouraging them to read the explanation is worth doing;
            trapping them until it arrives is not. The spinner above says it is coming; this
            always works.
          */}
          <Button onClick={() => void completeLearn()} disabled={submitting || learnDone}>
            {learnDone ? "Marked as done" : video ? "I've finished watching" : "I've finished reading"}
          </Button>
          {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {lesson.keyLearningPoints.length > 0 ? (
            <Card padding="md">
              <p className="mb-2 text-sm font-semibold text-ink">Key learning points</p>
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink-muted">
                {lesson.keyLearningPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </Card>
          ) : null}
          {lesson.keywords.length > 0 ? (
            <Card padding="md">
              <p className="mb-2 text-sm font-semibold text-ink">Keywords</p>
              <dl className="space-y-2 text-sm">
                {lesson.keywords.map((k) => (
                  <div key={k.keyword}>
                    <dt className="font-medium text-ink">{k.keyword}</dt>
                    <dd className="text-ink-muted">{k.description}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>
      </div>
    );
  }

  function renderFeedback() {
    const checkQs = questionsByStage.CHECK;
    const pct = scorePct(checkScore);
    // Below 70% the lesson has not landed. Mastery is preferred when we have it, because it
    // accounts for how they answered as well as what they scored.
    const secure = masteryEstimate != null ? masteryEstimate >= 0.7 : pct == null || pct >= 70;
    const timeRemaining = Math.max(0, lessonMinutes - Math.round(spentSeconds / 60));
    const wrongTopics = checkQs
      .filter((q) => results[q.id] && results[q.id]?.isCorrect === false)
      .map((q) => q.prompt.replace(/\s+/g, " ").trim())
      .map((prompt) => (prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt))
      .slice(0, 3);
    const masteryBadge: BadgeStatus | null =
      masteryEstimate == null ? null : masteryEstimate >= 0.9 ? "mastered" : masteryEstimate < 0.7 ? "needs-review" : "completed";

    return (
      <div className="space-y-5">
        <Card padding="lg" className="space-y-2 text-center">
          <p className="text-sm font-medium text-ink-muted">Your score</p>
          <p className="text-4xl font-semibold text-ink">{pct != null ? `${pct}%` : "–"}</p>
          {checkScore ? (
            <p className="text-sm text-ink-muted">
              {checkScore.score} out of {checkScore.maxScore}
            </p>
          ) : null}
          {masteryBadge ? (
            <div className="flex justify-center pt-1">
              <Badge status={masteryBadge} />
            </div>
          ) : null}
          {props.feedbackSummary ? (
            <p className="mx-auto max-w-prose pt-2 text-sm text-ink">{props.feedbackSummary}</p>
          ) : null}
        </Card>

        {checkQs.length > 0
          ? checkQs.map((q, i) => {
              const result = results[q.id];
              const attemptsUsed = checkAttemptCounts[q.id] ?? 0;
              const isRetrying = retryingIds.has(q.id);
              const canRetry = result?.isCorrect === false && attemptsUsed < 2 && !isRetrying;
              return (
                <Card key={q.id} padding="lg">
                  <p className="mb-3 text-xs font-medium text-ink-faint">
                    Question {i + 1} of {checkQs.length}
                  </p>
                  <p className="mb-4 text-base font-medium text-ink">{q.prompt}</p>
                  <QuestionRenderer
                    question={q}
                    value={drafts[q.id]}
                    onChange={(v) => updateDraft(q.id, v)}
                    disabled={!isRetrying}
                    result={isRetrying ? undefined : result}
                  />
                  {!isRetrying && result?.feedback ? (
                    <p className={cn("mt-3 text-sm", result.isCorrect ? "text-success" : "text-ink-muted")}>
                      {result.feedback}
                    </p>
                  ) : null}
                  {canRetry ? (
                    <div className="mt-3 space-y-1">
                      <Button variant="secondary" onClick={() => void startRetry(q.id)}>
                        Try again
                      </Button>
                      {/*
                        A retry can be refused — no attempts left, or it was already right. The
                        message belongs next to the button that was pressed; at the bottom of a
                        long page it reads as the button doing nothing at all.
                      */}
                      {retryError[q.id] ? (
                        <p className="text-sm text-danger">{retryError[q.id]}</p>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              );
            })
          : null}

        {/*
          A score is not teaching. Below the bar, finishing is not the next step — practising
          what they actually got wrong is, and the questions are written from those specific
          mistakes rather than being the same quiz again. They can still choose to stop: this
          is a nudge with a reason, not a lock on the door.
        */}
        {secure && timeRemaining >= 5 ? (
          // A period is 45 minutes. Finishing the quiz in twelve does not end the lesson — it
          // means the content ran out, and the honest response is more of it, not a break.
          <Card padding="lg" className="space-y-3 bg-accent-soft">
            <h3 className="text-base font-semibold text-ink">
              Good — and there&apos;s still {timeRemaining} minutes of this lesson.
            </h3>
            <p className="text-sm text-ink">
              Let&apos;s use them. Your teacher can set you harder questions on the same topic.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void practiseMore()} disabled={generatingPractice}>
                {generatingPractice ? "Writing your questions…" : "Keep going"}
              </Button>
            </div>
            {practiceError ? <p className="text-sm text-danger">{practiceError}</p> : null}
          </Card>
        ) : null}

        {/*
          The tutoring loop.

          A score below the bar is not a result to report, it is work to do. This finds what was
          not understood — the idea, not the question — explains it a different way each round,
          and asks them to say it back in their own words before it counts as closed. Getting
          questions right can be pattern-matching; explaining it back cannot.
        */}
        {!secure ? (
          <UnderstandingLoop
            lessonId={lesson.id}
            attemptId={attemptId}
            voice={voiceEnabled}
            onAllUnderstood={() => setGapsClosed(true)}
          />
        ) : null}

        {!secure ? (
          <Card padding="lg" className="space-y-3 border-warning/30 bg-warning-soft/40">
            <h3 className="text-base font-semibold text-ink">
              {gapsClosed ? "Now let's practise it." : "More practice on this, when you're ready."}
            </h3>
            <p className="text-sm text-ink">
              {wrongTopics.length > 0
                ? `The bit that tripped you up was ${wrongTopics.join(", ")}. A few questions on just that will sort it.`
                : "A few more questions on the parts you missed will sort this out."}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {extraPractice.length > 0 ? (
                <Button onClick={() => setViewStage("PRACTICE")}>Go to your practice</Button>
              ) : (
                <Button onClick={() => void practiseWeakSpots()} disabled={generatingPractice}>
                  {generatingPractice ? "Writing your questions…" : "Practise what I missed"}
                </Button>
              )}
              {/* Never removed: this is the way out when nothing else on the screen works. */}
              <Button variant="ghost" onClick={() => void finishLesson()} disabled={submitting}>
                {submitting ? "Finishing…" : "Finish anyway"}
              </Button>
            </div>
            {practiceError ? <p className="text-sm text-danger">{practiceError}</p> : null}
          </Card>
        ) : null}

        {/*
          Finishing is ALWAYS available. Encouraging a child to use the whole period is right;
          hiding the only door until a question-writing request succeeds is not — when that
          request failed, a child sat in front of a finished lesson with nothing to press and
          twenty minutes on the clock. The nudge above keeps the emphasis; this button is quiet
          while there is time left, and the obvious one when there isn't.
        */}
        <div className="flex flex-wrap items-center gap-3">
          {retryingIds.size > 0 ? (
            <Button onClick={() => void submitRetries()} disabled={submitting}>
              {submitting ? "Your teacher is checking…" : "Submit answer"}
            </Button>
          ) : null}
          {secure ? (
            <Button
              onClick={() => void finishLesson()}
              disabled={submitting}
              variant={timeRemaining >= 5 ? "secondary" : "primary"}
            >
              {submitting ? "Finishing…" : timeRemaining >= 5 ? "Finish this lesson" : "Finish"}
            </Button>
          ) : null}
          {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
        </div>
      </div>
    );
  }

  function renderComplete() {
    const attempt = finalAttempt;
    const pct = scorePct(attempt ?? undefined);
    // A period is 45 minutes. Racing through in twelve and going on a break is not a lesson —
    // it means the content ran out, not that the child is finished learning. Offer more of the
    // same topic rather than sending them away early.
    const minutesSpent = Math.round(spentSeconds / 60);
    const timeLeft = lessonMinutes - minutesSpent;
    const finishedEarly = timeLeft >= 5;
    const statusLabel =
      attempt?.status === "MASTERED" ? "mastered" : attempt?.status === "NEEDS_REVIEW" ? "completed — worth another look" : "completed";

    return (
      <Card padding="lg" className="mx-auto max-w-xl space-y-4 text-center">
        <PartyPopper className="mx-auto h-10 w-10 text-accent" />
        <h2 className="text-xl font-semibold text-ink">
          Well done — {lesson.title} is {statusLabel}.
        </h2>
        {pct != null ? <p className="text-3xl font-semibold text-ink">{pct}%</p> : null}
        {attempt?.masteryScore != null ? (
          <p className="text-sm text-ink-muted">Mastery {Math.round(attempt.masteryScore * 100)}%</p>
        ) : null}
        {finishedEarly ? (
          <div className="space-y-3 rounded-2xl bg-accent-soft p-5 text-left">
            <p className="text-base font-medium text-ink">
              That took {minutesSpent} minutes — you&apos;ve still got about {timeLeft} in this
              period.
            </p>
            <p className="text-sm text-ink-muted">
              Your teacher can set you more on the same topic. It counts towards this lesson.
            </p>
            {extraPractice.length > 0 ? (
              <Button onClick={() => setViewStage("PRACTICE")}>Go to your extra practice</Button>
            ) : (
              <Button onClick={() => void practiseMore()} disabled={generatingPractice}>
                {generatingPractice ? "Writing your questions…" : "Give me more practice"}
              </Button>
            )}
            {practiceError ? <p className="text-sm text-danger">{practiceError}</p> : null}
          </div>
        ) : null}

        <div className="pt-2">
          <BreakTimer
            minutes={breakMinutes}
            storageKey={attemptId}
            nextHref={nextLessonId ? `/lessons/${nextLessonId}` : "/today"}
            nextLabel={nextLessonId ? "Start the next lesson" : "Back to Today"}
          />
          <div className="pt-3">
            <Button href="/today" variant="ghost">
              Back to Today
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  /** Sends the pre-check to be marked on the server. Nothing is decided in the browser. */
  async function submitPreCheck() {
    setPreCheckBusy(true);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/pre-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: preCheckAnswers }),
      });
      const data = (await res.json()) as { passed?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not check that.");
      setPreCheckResult({ passed: Boolean(data.passed), message: data.message ?? "" });
      if (!data.passed) setTimeout(() => setPreCheckOpen(false), 1800);
    } catch {
      // If the check cannot be marked, the lesson is the safe place to be.
      setPreCheckOpen(false);
    } finally {
      setPreCheckBusy(false);
    }
  }

  function renderPreCheck() {
    const qs = questionsByStage.CHECK;
    const answered = Object.keys(preCheckAnswers).length;

    if (preCheckResult) {
      return (
        <Card padding="lg" className="mx-auto max-w-xl space-y-4 text-center">
          {preCheckResult.passed ? (
            <Check className="mx-auto h-10 w-10 text-success" />
          ) : (
            <Sparkles className="mx-auto h-10 w-10 text-accent" />
          )}
          <h2 className="text-xl font-semibold text-ink">{preCheckResult.message}</h2>
          {preCheckResult.passed ? (
            <Button href={nextLessonId ? `/lessons/${nextLessonId}` : "/today"} size="lg">
              {nextLessonId ? "On to the next lesson" : "Back to Today"}
            </Button>
          ) : (
            <p className="text-sm text-ink-muted">Starting the lesson…</p>
          )}
        </Card>
      );
    }

    return (
      <Card padding="lg" className="mx-auto max-w-2xl space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-ink">Do you already know this?</h2>
          <p className="text-sm text-ink-muted">
            A few questions from the end of the lesson. Get them right and you can skip
            straight past it — no point being taught something you can already do.
          </p>
        </div>

        {qs.map((q, i) => (
          <div key={q.id} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Question {i + 1} of {qs.length}
            </p>
            {/* The renderer draws the answer controls; the question itself is the caller's job. */}
            <p className="text-base font-medium leading-relaxed text-ink">{q.prompt}</p>
            <QuestionRenderer
              question={q}
              value={preCheckAnswers[q.id]}
              onChange={(v) => setPreCheckAnswers((prev) => ({ ...prev, [q.id]: v }))}
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button onClick={() => void submitPreCheck()} disabled={preCheckBusy || answered === 0}>
            {preCheckBusy ? "Checking…" : "Check my answers"}
          </Button>
          <Button variant="ghost" onClick={() => setPreCheckOpen(false)}>
            I don&apos;t know this topic
          </Button>
        </div>
        <p className="text-xs text-ink-faint">
          Not sure? Take the lesson. Skipping something you half-know leaves a gap that turns up
          later.
        </p>
      </Card>
    );
  }

  // ───────────────────────────── layout ─────────────────────────────

  if (preCheckOpen && questionsByStage.CHECK.length >= 3) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <span className={cn("text-xs font-semibold uppercase tracking-wide", theme.text)}>
            {subjectTitle}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{lesson.title}</h1>
        </div>
        {renderPreCheck()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <SubjectArt subjectSlug={subjectSlug} className="h-20 sm:h-24" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("text-xs font-semibold uppercase tracking-wide", theme.text)}>{subjectTitle}</span>
              <span className="text-xs text-ink-faint">·</span>
              <span className="truncate text-xs text-ink-faint">{unitTitle}</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{lesson.title}</h1>
            {/* The period length, not the content's own estimate: the timetable is what the day runs to. */}
            <p className="text-xs text-ink-faint">{formatMinutes(lessonMinutes)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {viewStage !== "COMPLETE" ? (
              <LessonTimer attemptId={attemptId} minutes={lessonMinutes} initialSeconds={elapsedSeconds} />
            ) : null}
            <p className="text-sm font-medium text-ink-muted">
              {viewStage === "COMPLETE" ? "Complete" : `Step ${Math.min(stageIndex(viewStage) + 1, 5)} of 5`}
            </p>
          </div>
        </div>

        {viewStage !== "COMPLETE" ? (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {RAIL_STAGES.map((item, i) => {
              const idx = stageIndex(item.stage);
              const currentIdx = stageIndex(currentStage);
              const status: "done" | "current" | "locked" = idx < currentIdx ? "done" : idx === currentIdx ? "current" : "locked";
              const active = viewStage === item.stage;
              return (
                <div key={item.stage} className="flex shrink-0 items-center">
                  {i > 0 ? <span className="h-px w-4 shrink-0 bg-line" /> : null}
                  <button
                    type="button"
                    disabled={status === "locked"}
                    onClick={() => selectStage(item.stage)}
                    className={cn(
                      "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium whitespace-nowrap transition-colors duration-150",
                      "disabled:cursor-not-allowed",
                      active
                        ? "bg-accent text-white"
                        : status === "done"
                          ? "bg-success-soft text-success"
                          : status === "current"
                            ? "bg-accent-soft text-accent-ink"
                            : "bg-stone-100 text-ink-faint",
                    )}
                  >
                    {status === "done" ? <Check className="h-3 w-3" /> : status === "locked" ? <Lock className="h-3 w-3" /> : null}
                    {item.label}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        <div className="min-w-0">
          {viewStage === "STARTER" ? renderQuizStage("STARTER") : null}
          {viewStage === "LEARN" ? renderLearn() : null}
          {viewStage === "PRACTICE" ? renderPractice() : null}
          {viewStage === "CHECK" ? renderQuizStage("CHECK") : null}
          {viewStage === "FEEDBACK" ? renderFeedback() : null}
          {viewStage === "COMPLETE" ? renderComplete() : null}
        </div>

        {viewStage !== "COMPLETE" ? (
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)]">
            <Card padding="lg" className="flex h-[calc(100dvh-6rem)] flex-col">
              <TeacherPanel lessonAttemptId={attemptId} questionId={currentQuestionId} stage={viewStage} voice={voiceEnabled} view={teacherView} />
            </Card>
          </aside>
        ) : null}
      </div>

      {viewStage !== "COMPLETE" ? (
        <>
          <button
            type="button"
            onClick={() => setTeacherSheetOpen(true)}
            className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform duration-150 active:scale-95 lg:hidden"
            aria-label="Ask your teacher"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
          <Sheet open={teacherSheetOpen} onClose={() => setTeacherSheetOpen(false)} side="bottom" title="Ask your teacher">
            <div className="flex h-[70dvh] flex-col">
              <TeacherPanel lessonAttemptId={attemptId} questionId={currentQuestionId} stage={viewStage} voice={voiceEnabled} view={teacherView} />
            </div>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}
