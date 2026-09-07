"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Ban, MessageSquarePlus, RotateCcw, DoorOpen, CircleCheckBig, Gauge } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";

type OverrideType =
  | "SCORE"
  | "MARK_CORRECT"
  | "MASTERY"
  | "LESSON_COMPLETE"
  | "RESET_QUIZ"
  | "REOPEN_LESSON"
  | "EXCLUDE_QUESTION"
  | "COMMENT";

async function postOverride(body: {
  studentId: string;
  type: OverrideType;
  questionAttemptId?: string;
  lessonAttemptId?: string;
  lessonId?: string;
  questionId?: string;
  value?: unknown;
  comment?: string;
}): Promise<void> {
  const res = await fetch("/api/admin/overrides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ?? "Could not save that change");
  }
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-xs text-danger">{error}</p>;
}

// ───────────────────────────── question-level ─────────────────────────────

export function QuestionOverrideControls({
  studentId,
  questionAttemptId,
  questionId,
  maxScore,
  isCorrect,
  excluded,
}: {
  studentId: string;
  questionAttemptId: string;
  questionId: string;
  maxScore: number;
  isCorrect: boolean | null;
  excluded: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [score, setScore] = useState(String(maxScore));
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");

  async function run(label: string, fn: () => Promise<void>) {
    setPending(label);
    setError(null);
    try {
      await fn();
      router.refresh();
      setScoreOpen(false);
      setCommentOpen(false);
      setComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pending !== null || isCorrect === true}
          onClick={() =>
            run("correct", () => postOverride({ studentId, type: "MARK_CORRECT", questionAttemptId, questionId }))
          }
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors",
            "bg-success-soft text-success hover:brightness-95 disabled:opacity-40"
          )}
        >
          <Check className="h-3.5 w-3.5" /> Mark correct
        </button>

        <button
          type="button"
          disabled={pending !== null}
          onClick={() => setScoreOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-stone-100 px-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-stone-200"
        >
          <Gauge className="h-3.5 w-3.5" /> Set score
        </button>

        <button
          type="button"
          disabled={pending !== null || excluded}
          onClick={() =>
            run("exclude", () => postOverride({ studentId, type: "EXCLUDE_QUESTION", questionId }))
          }
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-danger-soft px-2.5 text-xs font-medium text-danger transition-colors hover:brightness-95 disabled:opacity-40"
        >
          <Ban className="h-3.5 w-3.5" /> {excluded ? "Excluded" : "Exclude"}
        </button>

        <button
          type="button"
          disabled={pending !== null}
          onClick={() => setCommentOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-stone-100 px-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-stone-200"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" /> Comment
        </button>
      </div>

      {scoreOpen ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={maxScore}
            step="any"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="h-9 w-24"
          />
          <span className="text-xs text-ink-muted">/ {maxScore}</span>
          <Button
            size="md"
            className="h-9"
            disabled={pending !== null}
            onClick={() =>
              run("score", () =>
                postOverride({ studentId, type: "SCORE", questionAttemptId, questionId, value: Number(score) })
              )
            }
          >
            Save
          </Button>
        </div>
      ) : null}

      {commentOpen ? (
        <div className="space-y-2">
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note for this answer…"
          />
          <Button
            size="md"
            className="h-9"
            disabled={pending !== null || comment.trim().length === 0}
            onClick={() =>
              run("comment", () => postOverride({ studentId, type: "COMMENT", questionAttemptId, questionId, comment }))
            }
          >
            Save comment
          </Button>
        </div>
      ) : null}

      <ErrorLine error={error} />
    </div>
  );
}

// ───────────────────────────── lesson-level ─────────────────────────────

const REOPEN_STAGES = ["STARTER", "LEARN", "PRACTICE", "CHECK", "FEEDBACK"] as const;

export function LessonOverrideControls({
  studentId,
  lessonAttemptId,
  lessonId,
}: {
  studentId: string;
  lessonAttemptId: string;
  lessonId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reopenStage, setReopenStage] = useState<(typeof REOPEN_STAGES)[number]>("PRACTICE");
  const [masteryOpen, setMasteryOpen] = useState(false);
  const [mastery, setMastery] = useState("80");
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");

  async function run(label: string, fn: () => Promise<void>) {
    setPending(label);
    setError(null);
    try {
      await fn();
      router.refresh();
      setCommentOpen(false);
      setComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Lesson controls</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          disabled={pending !== null}
          onClick={() => run("complete", () => postOverride({ studentId, type: "LESSON_COMPLETE", lessonAttemptId }))}
        >
          <CircleCheckBig className="h-4 w-4" /> Mark complete
        </Button>

        <Button
          variant="secondary"
          size="md"
          disabled={pending !== null}
          onClick={() => run("reset", () => postOverride({ studentId, type: "RESET_QUIZ", lessonAttemptId }))}
        >
          <RotateCcw className="h-4 w-4" /> Reset quiz
        </Button>

        <div className="flex items-center gap-1.5">
          <select
            value={reopenStage}
            onChange={(e) => setReopenStage(e.target.value as (typeof REOPEN_STAGES)[number])}
            className="h-11 rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          >
            {REOPEN_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="md"
            disabled={pending !== null}
            onClick={() =>
              run("reopen", () =>
                postOverride({ studentId, type: "REOPEN_LESSON", lessonAttemptId, value: reopenStage })
              )
            }
          >
            <DoorOpen className="h-4 w-4" /> Reopen
          </Button>
        </div>

        <Button variant="secondary" size="md" disabled={pending !== null} onClick={() => setMasteryOpen((v) => !v)}>
          <Gauge className="h-4 w-4" /> Set mastery
        </Button>

        <Button variant="secondary" size="md" disabled={pending !== null} onClick={() => setCommentOpen((v) => !v)}>
          <MessageSquarePlus className="h-4 w-4" /> Add comment
        </Button>
      </div>

      {masteryOpen ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            value={mastery}
            onChange={(e) => setMastery(e.target.value)}
            className="h-9 w-24"
          />
          <span className="text-xs text-ink-muted">%</span>
          <Button
            size="md"
            className="h-9"
            disabled={pending !== null}
            onClick={() =>
              run("mastery", () =>
                postOverride({ studentId, type: "MASTERY", lessonAttemptId, lessonId, value: Number(mastery) / 100 })
              )
            }
          >
            Save
          </Button>
        </div>
      ) : null}

      {commentOpen ? (
        <div className="space-y-2">
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note for this lesson…" />
          <Button
            size="md"
            className="h-9"
            disabled={pending !== null || comment.trim().length === 0}
            onClick={() => run("comment", () => postOverride({ studentId, type: "COMMENT", lessonAttemptId, lessonId, comment }))}
          >
            Save comment
          </Button>
        </div>
      ) : null}

      <ErrorLine error={error} />
    </div>
  );
}
