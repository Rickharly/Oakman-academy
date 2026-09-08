"use client";

import { useRef, useState, type SyntheticEvent } from "react";
import { Check, ExternalLink, FileText, Loader2, Lock, MessageCircle, PartyPopper } from "lucide-react";
import type { LessonStage } from "@/generated/prisma/client";
import { nextStage, stageIndex } from "@/lib/lessons/stages";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { QuestionRenderer } from "@/components/student/questions/QuestionRenderer";
import type { QuestionResult, StudentQuestionLite } from "@/components/student/questions/types";
import { TeacherPanel } from "@/components/student/TeacherPanel";
import { subjectTheme } from "@/components/student/subjectTheme";
import { SubjectArt } from "@/components/student/SubjectArt";
import { LessonTimer } from "@/components/student/LessonTimer";
import { BreakTimer } from "@/components/student/BreakTimer";
import { formatMinutes } from "@/components/student/format";
import { cn } from "@/lib/cn";

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
    /** The lesson on Oak National Academy's own site — the fallback when we have no video. */
    oakUrl?: string | null;
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
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [extraPractice, setExtraPractice] = useState<LessonPlayerQuestion[]>([]);

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
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
      setExtraPractice(data.questions);
      setViewStage("PRACTICE");
    } catch (err) {
      setPracticeError(err instanceof Error ? err.message : "Couldn't write the questions.");
    } finally {
      setGeneratingPractice(false);
    }
  }

  function renderPractice() {
    const qs = questionsByStage.PRACTICE.length ? questionsByStage.PRACTICE : extraPractice;
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
    const video = lesson.resources.find((r) => r.type === "VIDEO" && Boolean(r.providerUrl || r.storedPath));
    const learnDone = stageIndex(currentStage) > stageIndex("LEARN");

    return (
      <div className="space-y-6">
        <Card padding="lg" className="space-y-4">
          {video ? (
            <video
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-xl bg-stone-900"
              src={video.storedPath ?? `/api/curriculum/resources/${video.id}`}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
            />
          ) : (
            <>
              {/*
                No video file for this lesson. Oak has one on their own site, so send them
                there rather than pretending the lesson has no teaching in it — a transcript
                is a poor substitute for being taught something.
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
                <div className="space-y-3 text-[15px] leading-relaxed text-ink">
                  {lesson.oakUrl ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      What the teacher says, in words
                    </p>
                  ) : null}
                  {lesson.transcript
                    .split(/\n{2,}/)
                    .filter((p) => p.trim().length > 0)
                    .map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                </div>
              ) : lesson.oakUrl ? null : (
                <p className="text-ink-muted">No content is available for this lesson yet.</p>
              )}
            </>
          )}

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
                    <Button variant="secondary" className="mt-3" onClick={() => void startRetry(q.id)}>
                      Try again
                    </Button>
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
        {!secure ? (
          <Card padding="lg" className="space-y-3 border-warning/30 bg-warning-soft/40">
            <h3 className="text-base font-semibold text-ink">
              Let&apos;s make this stick before you move on.
            </h3>
            <p className="text-sm text-ink">
              {wrongTopics.length > 0
                ? `The bit that tripped you up was ${wrongTopics.join(", ")}. A few questions on just that will sort it.`
                : "A few more questions on the parts you missed will sort this out."}
            </p>
            {extraPractice.length > 0 ? (
              <p className="text-sm font-medium text-ink">
                Your practice is ready — it&apos;s in the Practice step above.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void practiseWeakSpots()} disabled={generatingPractice}>
                  {generatingPractice ? "Writing your questions…" : "Practise what I missed"}
                </Button>
                <Button variant="ghost" onClick={() => void finishLesson()} disabled={submitting}>
                  Finish anyway
                </Button>
              </div>
            )}
            {practiceError ? <p className="text-sm text-danger">{practiceError}</p> : null}
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {retryingIds.size > 0 ? (
            <Button onClick={() => void submitRetries()} disabled={submitting}>
              {submitting ? "Your teacher is checking…" : "Submit answer"}
            </Button>
          ) : secure ? (
            <Button onClick={() => void finishLesson()} disabled={submitting}>
              {submitting ? "Finishing…" : "Finish"}
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

  // ───────────────────────────── layout ─────────────────────────────

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
              <TeacherPanel lessonAttemptId={attemptId} questionId={currentQuestionId} stage={viewStage} />
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
              <TeacherPanel lessonAttemptId={attemptId} questionId={currentQuestionId} stage={viewStage} />
            </div>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}
