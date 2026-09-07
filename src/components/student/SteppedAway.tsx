"use client";

import { useCallback, useState } from "react";
import { Coffee, Pause } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * "I need a moment."
 *
 * A child who leaves the screen for five minutes has not necessarily stopped working — they
 * have gone to the toilet, or their mum called them. This lets them say so, which turns an
 * unexplained gap in the record into an explained one and pauses the lesson clock while
 * they're gone.
 *
 * It is framed as a pause, not a confession: no warnings, no limits, nothing counted against
 * them on screen. The reasons exist so a parent reading the day later has the context, not so
 * a child has to justify themselves to an app.
 */
const REASONS = [
  { kind: "TOILET", label: "Toilet" },
  { kind: "DRINK", label: "Drink or snack" },
  { kind: "CALLED_AWAY", label: "Someone needs me" },
  { kind: "OTHER", label: "Something else" },
] as const;

export function SteppedAway({
  attemptId,
  onChange,
}: {
  attemptId: string;
  onChange: (away: boolean) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [away, setAway] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);

  const start = useCallback(
    async (kind: (typeof REASONS)[number]["kind"]) => {
      setPicking(false);
      setAway(true);
      onChange(true);
      try {
        const res = await fetch(`/api/attempts/${attemptId}/focus`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start", kind }),
        });
        const data = (await res.json()) as { eventId?: string };
        if (data.eventId) setEventId(data.eventId);
      } catch {
        // The pause still works locally; only the record misses out.
      }
    },
    [attemptId, onChange],
  );

  const end = useCallback(async () => {
    setAway(false);
    onChange(false);
    try {
      await fetch(`/api/attempts/${attemptId}/focus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", ...(eventId ? { eventId } : {}) }),
      });
    } catch {
      // Nothing to do: they are back either way.
    }
    setEventId(null);
  }, [attemptId, eventId, onChange]);

  if (away) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="away-title"
      >
        <div className="w-full max-w-sm space-y-4 rounded-3xl bg-surface-raised p-8 text-center shadow-xl">
          <Coffee className="mx-auto h-8 w-8 text-ink-muted" aria-hidden="true" />
          <h2 id="away-title" className="text-xl font-semibold text-ink">
            Paused. Take your time.
          </h2>
          <p className="text-sm text-ink-muted">
            Your lesson is waiting exactly where you left it. The clock has stopped.
          </p>
          <Button onClick={end} size="lg" className="w-full">
            I&apos;m back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setPicking((v) => !v)}
        className="flex h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-stone-100 hover:text-ink"
        aria-expanded={picking}
        aria-haspopup="menu"
      >
        <Pause className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">I need a moment</span>
      </button>

      {picking ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setPicking(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface-raised py-1 shadow-lg"
          >
            <p className="px-4 py-2 text-xs text-ink-muted">Just so we know why the page went quiet.</p>
            {REASONS.map((reason) => (
              <button
                key={reason.kind}
                type="button"
                role="menuitem"
                onClick={() => start(reason.kind)}
                className="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-sm text-ink transition-colors duration-150 hover:bg-stone-100"
              >
                {reason.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
