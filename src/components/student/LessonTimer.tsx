"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The lesson clock: counts down the period while the child is actually working.
 *
 * It runs on time spent, not wall clock. If they step away, close the tab, or come back after
 * lunch, the period picks up where it left off rather than having silently expired — the point
 * is to give the day a rhythm, not to punish a bathroom break.
 *
 * When the period runs out nothing is taken away: the banner simply changes to say time is up.
 * A child mid-sentence on a question should never be thrown out of it by a timer.
 */
type LessonTimerProps = {
  attemptId: string;
  /** Length of the period, in minutes. */
  minutes: number;
  /** Seconds already spent in this lesson, from the server. */
  initialSeconds: number;
  className?: string;
};

const SAVE_EVERY_SECONDS = 30;

function format(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LessonTimer({ attemptId, minutes, initialSeconds, className }: LessonTimerProps) {
  const total = minutes * 60;
  const [elapsed, setElapsed] = useState(initialSeconds);
  const unsavedRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function save(seconds: number) {
      if (seconds <= 0) return;
      try {
        await fetch(`/api/attempts/${attemptId}/time`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seconds }),
          keepalive: true,
        });
      } catch {
        // Losing a few seconds of recorded time is not worth interrupting the lesson.
      }
    }

    const id = setInterval(() => {
      // The clock only advances while the lesson is actually on screen.
      if (document.hidden || cancelled) return;
      setElapsed((e) => e + 1);
      unsavedRef.current += 1;
      if (unsavedRef.current >= SAVE_EVERY_SECONDS) {
        const seconds = unsavedRef.current;
        unsavedRef.current = 0;
        void save(seconds);
      }
    }, 1000);

    const flush = () => {
      const seconds = unsavedRef.current;
      unsavedRef.current = 0;
      void save(seconds);
    };
    window.addEventListener("pagehide", flush);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [attemptId]);

  const remaining = total - elapsed;
  const overtime = remaining <= 0;
  const nearlyDone = !overtime && remaining <= 5 * 60;
  const pct = Math.min(100, Math.round((elapsed / total) * 100));

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-full border px-3 py-1.5",
        overtime
          ? "border-gold/40 bg-gold-soft text-gold-ink"
          : nearlyDone
            ? "border-warning/30 bg-warning-soft text-warning"
            : "border-line bg-surface text-ink-muted",
        className,
      )}
      role="timer"
      aria-live="off"
    >
      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium tabular-nums">
        {overtime ? "Time's up — finish when you're ready" : format(remaining)}
      </span>
      {!overtime ? (
        <span className="hidden h-1 w-16 overflow-hidden rounded-full bg-line sm:block" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </span>
      ) : null}
      <span className="sr-only">
        {overtime
          ? "The lesson time is up. You can keep going and finish when you are ready."
          : `${Math.ceil(remaining / 60)} minutes left in this lesson.`}
      </span>
    </div>
  );
}
