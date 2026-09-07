"use client";

import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * The break between periods, shown once a lesson is finished.
 *
 * It counts down in real time — a break is wall-clock time by definition — and stores when it
 * started so that closing the tab does not hand the child a fresh ten minutes. The button to
 * carry on is never disabled: this is an encouragement to rest, not a lock on the next lesson.
 */
type BreakTimerProps = {
  minutes: number;
  /** Where "next lesson" goes. Falls back to Today when the day is finished. */
  nextHref: string;
  nextLabel: string;
  /** Distinguishes one lesson's break from another in storage. */
  storageKey: string;
};

function format(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function BreakTimer({ minutes, nextHref, nextLabel, storageKey }: BreakTimerProps) {
  const total = minutes * 60;
  const [remaining, setRemaining] = useState(total);

  useEffect(() => {
    const key = `break:${storageKey}`;
    let startedAt: number;
    try {
      const stored = window.sessionStorage.getItem(key);
      startedAt = stored ? Number(stored) : Date.now();
      if (!stored) window.sessionStorage.setItem(key, String(startedAt));
    } catch {
      startedAt = Date.now();
    }

    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setRemaining(Math.max(0, total - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [storageKey, total]);

  const over = remaining <= 0;

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
        <Coffee className="h-5 w-5 text-accent" aria-hidden="true" />
      </span>
      <p className="mt-3 text-base font-semibold text-ink">
        {over ? "Break over — ready when you are" : "Take a break"}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        {over
          ? "Stretch done? Start the next lesson."
          : `Get a drink and move about. The next lesson starts in ${Math.ceil(remaining / 60)} minute${
              Math.ceil(remaining / 60) === 1 ? "" : "s"
            }.`}
      </p>

      {!over ? (
        <p className="mt-4 text-3xl font-semibold tabular-nums text-ink" role="timer" aria-live="off">
          {format(remaining)}
        </p>
      ) : null}

      <Button href={nextHref} size="lg" className="mt-5 w-full sm:w-auto">
        {nextLabel}
      </Button>
    </div>
  );
}
