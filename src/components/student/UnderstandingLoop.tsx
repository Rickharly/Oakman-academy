"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ReadAloud } from "@/components/student/ReadAloud";
import { cn } from "@/lib/cn";

/**
 * The bit where a tutor differs from a school.
 *
 * A school marks the quiz and moves to the next lesson. Here, a check that went badly opens a
 * conversation: this is what you have not got, here it is explained a different way, now say it
 * back to me in your own words. Answering questions right can be pattern-matching; explaining
 * it back is the thing that cannot be faked, so that is what closes it.
 *
 * Every round uses a strategy the last one did not — plainer words, a comparison, one worked
 * through, teaching it back, or going down a step and rebuilding. When those run out the honest
 * move is to stop for today and pick it up tomorrow, not to grind a tired child.
 */

type Gap = {
  id: string;
  concept: string;
  status: "OPEN" | "UNDERSTOOD" | "PARKED";
  round: number;
  explanation?: Explanation | null;
};

type Explanation = {
  explanation: string;
  checkQuestion: string;
  strategy: string;
};

type Verdict = { understood: boolean; feedback: string; stillMissing: string | null };

const STRATEGY_LABEL: Record<string, string> = {
  SIMPLER: "Let me put that more simply",
  ANALOGY: "Here's another way to picture it",
  WORKED_EXAMPLE: "Let's do one together",
  ROLE_PLAY: "Your turn to teach me",
  BUILD_UP: "Let's go back a step",
};

export function UnderstandingLoop({
  lessonId,
  attemptId,
  voice = false,
  onAllUnderstood,
}: {
  lessonId: string;
  attemptId: string;
  /** Whether this child's teacher reads aloud. */
  voice?: boolean;
  /** Called when nothing is left open, so the lesson can offer to move on. */
  onAllUnderstood?: () => void;
}) {
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"diagnose" | "reteach" | "explain" | null>(null);
  const [words, setWords] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asked = useRef(false);

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`/api/lessons/${lessonId}/understand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  // Work out what they did not understand, once, on arrival.
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void (async () => {
      setBusy("diagnose");
      try {
        const data = await post({ action: "diagnose" });
        const found: Gap[] = data.gaps ?? [];
        setGaps(found);
        const firstOpen = found.find((g) => g.status === "OPEN");
        setActiveId(firstOpen?.id ?? null);
        if (found.length === 0) onAllUnderstood?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = gaps?.find((g) => g.id === activeId) ?? null;

  async function explainAgain() {
    if (!active || busy) return;
    setBusy("reteach");
    setError(null);
    setVerdict(null);
    setWords("");
    try {
      const data = await post({ action: "reteach", gapId: active.id });
      if (data.exhausted) {
        setExhausted(true);
        return;
      }
      setGaps((prev) =>
        (prev ?? []).map((g) =>
          g.id === active.id ? { ...g, explanation: data.explanation, round: g.round + 1 } : g,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function sendExplanation() {
    if (!active || !words.trim() || busy) return;
    setBusy("explain");
    setError(null);
    try {
      const data = await post({ action: "explain", gapId: active.id, text: words.trim() });
      const v: Verdict = data.verdict;
      setVerdict(v);
      if (v.understood) {
        const next = (gaps ?? []).map((g) =>
          g.id === active.id ? { ...g, status: "UNDERSTOOD" as const } : g,
        );
        setGaps(next);
        if (data.remaining === 0) onAllUnderstood?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function moveToNextGap() {
    const next = (gaps ?? []).find((g) => g.status === "OPEN" && g.id !== activeId);
    setActiveId(next?.id ?? null);
    setVerdict(null);
    setWords("");
    setExhausted(false);
  }

  if (busy === "diagnose") {
    return (
      <Card padding="lg" className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <p className="text-ink">Let me look at what tripped you up…</p>
      </Card>
    );
  }

  if (!gaps || gaps.length === 0) return null;

  const openCount = gaps.filter((g) => g.status === "OPEN").length;

  if (openCount === 0) {
    return (
      <Card padding="lg" className="space-y-2 border-success/30 bg-success-soft/50">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-success" />
          <p className="text-base font-semibold text-ink">You&apos;ve got it now.</p>
        </div>
        <p className="text-sm text-ink">
          You explained {gaps.length === 1 ? "it" : "all of them"} back in your own words, which
          is the bit that actually counts. On you go.
        </p>
      </Card>
    );
  }

  if (!active) return null;

  const explanation = active.explanation;

  return (
    <Card padding="lg" className="space-y-5 border-accent/20 bg-accent-soft/40">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Before we move on
        </p>
        <h3 className="text-base font-semibold text-ink">{active.concept}</h3>
        {gaps.length > 1 ? (
          <p className="text-xs text-ink-muted">
            {gaps.filter((g) => g.status === "UNDERSTOOD").length} of {gaps.length} sorted
          </p>
        ) : null}
      </div>

      {!explanation ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">
            This one didn&apos;t land yet — that&apos;s completely normal, and it&apos;s worth five
            minutes. Let me explain it a different way.
          </p>
          <Button onClick={() => void explainAgain()} disabled={busy !== null}>
            {busy === "reteach" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking how best to say it…
              </>
            ) : (
              "Explain it to me again"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-ink-muted">
              {STRATEGY_LABEL[explanation.strategy] ?? "Another way of looking at it"}
            </p>
            {explanation.explanation.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-ink">
                {para}
              </p>
            ))}
            {voice ? <ReadAloud parts={[explanation.explanation, explanation.checkQuestion]} /> : null}
          </div>

          <div className="space-y-2 rounded-2xl bg-surface-raised p-4">
            <p className="text-sm font-medium text-ink">{explanation.checkQuestion}</p>
            <p className="text-xs text-ink-muted">
              In your own words — I&apos;m not after the exact wording, I want to hear you think.
            </p>
            <Textarea
              value={words}
              onChange={(e) => setWords(e.target.value)}
              rows={3}
              placeholder="Have a go…"
              disabled={busy !== null || verdict?.understood === true}
              className="w-full"
            />
            {!verdict?.understood ? (
              <Button onClick={() => void sendExplanation()} disabled={busy !== null || !words.trim()}>
                {busy === "explain" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Reading what you wrote…
                  </>
                ) : (
                  "That's what I think"
                )}
              </Button>
            ) : null}
          </div>

          {verdict ? (
            <div
              className={cn(
                "space-y-3 rounded-2xl p-4",
                verdict.understood ? "border border-success/30 bg-success-soft/60" : "bg-surface-raised",
              )}
            >
              <div className="flex items-start gap-2">
                {verdict.understood ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                )}
                <p className="text-sm text-ink">{verdict.feedback}</p>
              </div>

              {verdict.understood ? (
                openCount > 1 ? (
                  <Button onClick={moveToNextGap}>Next thing</Button>
                ) : null
              ) : exhausted ? (
                // Every approach has been tried. Stopping is the kind thing and the honest one:
                // it goes on tomorrow's list rather than being written off as understood.
                <div className="space-y-2">
                  <p className="text-sm text-ink">
                    We&apos;ve come at this from every angle I&apos;ve got, and it&apos;s not
                    clicking today. That happens — it&apos;s not you. I&apos;ll bring it back
                    tomorrow when you&apos;re fresh.
                  </p>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => void explainAgain()} disabled={busy !== null}>
                  {busy === "reteach" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Trying another way…
                    </>
                  ) : (
                    "Try explaining it another way"
                  )}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </Card>
  );
}
