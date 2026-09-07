"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { SteppedAway } from "./SteppedAway";

/**
 * The lesson clock: counts down the period while the child is actually working.
 *
 * It runs on time spent, not wall clock. If they step away, close the tab, or come back after
 * lunch, the period picks up where it left off rather than having silently expired — the point
 * is to give the day a rhythm, not to punish a bathroom break.
 *
 * When the period runs out nothing is taken away: the banner simply changes to say time is up.
 * A child mid-sentence on a question should never be thrown out of it by a timer.
 *
 * Alongside the clock it records *how* the time went — interacting, idle, or away with a
 * reason the child gave. That breakdown is for the parent's record and is deliberately never
 * shown here: a child watching a focus score would learn to game it rather than to work.
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
/** No click, key, scroll or touch for this long and the time stops counting as work. */
const IDLE_AFTER_SECONDS = 120;

function format(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LessonTimer({ attemptId, minutes, initialSeconds, className }: LessonTimerProps) {
  const total = minutes * 60;
  const [elapsed, setElapsed] = useState(initialSeconds);
  const [away, setAway] = useState(false);

  // Refs, not state: these tick every second and must not re-render the lesson.
  const sinceInteractionRef = useRef(0);
  const awayRef = useRef(false);
  const pendingRef = useRef({ active: 0, idle: 0, awayTime: 0 });

  const handleAwayChange = useCallback((isAway: boolean) => {
    awayRef.current = isAway;
    setAway(isAway);
    if (!isAway) sinceInteractionRef.current = 0;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function save(slice: { active: number; idle: number; awayTime: number }) {
      const seconds = slice.active + slice.idle + slice.awayTime;
      if (seconds <= 0) return;
      try {
        await fetch(`/api/attempts/${attemptId}/time`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seconds,
            activeSeconds: slice.active,
            idleSeconds: slice.idle,
            awaySeconds: slice.awayTime,
          }),
          keepalive: true,
        });
      } catch {
        // Losing a few seconds of recorded time is not worth interrupting the lesson.
      }
    }

    const touch = () => {
      sinceInteractionRef.current = 0;
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart", "input"] as const;
    for (const name of events) window.addEventListener(name, touch, { passive: true });

    const id = setInterval(() => {
      // The clock only advances while the lesson is actually on screen.
      if (document.hidden || cancelled) return;

      const pending = pendingRef.current;
      if (awayRef.current) {
        // Flagged time is neither work nor drifting off. The countdown pauses for it.
        pending.awayTime += 1;
      } else {
        sinceInteractionRef.current += 1;
        setElapsed((e) => e + 1);
        if (sinceInteractionRef.current > IDLE_AFTER_SECONDS) pending.idle += 1;
        else pending.active += 1;
      }

      if (pending.active + pending.idle + pending.awayTime >= SAVE_EVERY_SECONDS) {
        const slice = { ...pending };
        pendingRef.current = { active: 0, idle: 0, awayTime: 0 };
        void save(slice);
      }
    }, 1000);

    const flush = () => {
      const slice = { ...pendingRef.current };
      pendingRef.current = { active: 0, idle: 0, awayTime: 0 };
      void save(slice);
    };
    window.addEventListener("pagehide", flush);

    return () => {
      cancelled = true;
      clearInterval(id);
      for (const name of events) window.removeEventListener(name, touch);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [attemptId]);

  const remaining = total - elapsed;
  const overtime = remaining <= 0;
  const nearlyDone = !overtime && remaining <= 5 * 60;
  const pct = Math.min(100, Math.round((elapsed / total) * 100));

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-full border px-3 py-1.5",
          away
            ? "border-line bg-stone-100 text-ink-muted"
            : overtime
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
          {away ? "Paused" : overtime ? "Time's up — finish when you're ready" : format(remaining)}
        </span>
        {!overtime && !away ? (
          <span className="hidden h-1 w-16 overflow-hidden rounded-full bg-line sm:block" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </span>
        ) : null}
        <span className="sr-only">
          {away
            ? "The lesson is paused while you are away."
            : overtime
              ? "The lesson time is up. You can keep going and finish when you are ready."
              : `${Math.ceil(remaining / 60)} minutes left in this lesson.`}
        </span>
      </div>

      <SteppedAway attemptId={attemptId} onChange={handleAwayChange} />
    </div>
  );
}
