"use client";

import { useEffect, useRef, useState } from "react";
import { Hand } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * The teacher noticing that nothing has happened for a while.
 *
 * A period is forty-five minutes and a child alone in a room can spend twenty of them not
 * working, which nobody finds out about until the day is over and the work is thin. A teacher
 * in the room would have said something after a minute. This does.
 *
 * What counts as "nothing happening" matters more than the timer does. Reading is not idling
 * and neither is watching or listening, so scrolling, typing, tapping and any playing audio or
 * video all count as working — otherwise a child reading the lesson properly gets interrupted
 * for doing exactly what they were asked to do, which teaches them to stop reading.
 *
 * It is a nudge, not a wall: one tap dismisses it, nothing is recorded against them, and it
 * never covers the work.
 */
const IDLE_MS = 60_000;
/** Reading a written lesson is long stretches of stillness by design. */
const READING_IDLE_MS = 180_000;

export function StillThere({
  stage,
  studentName,
  onWakeUp,
}: {
  stage: string;
  studentName?: string;
  /** Somewhere to send them — the thing they should be doing right now. */
  onWakeUp?: () => void;
}) {
  const [showing, setShowing] = useState(false);
  // Set when the watcher starts, not during render — the clock is not ours to read while
  // React is deciding what the page looks like.
  const lastMove = useRef(0);
  const dismissedAt = useRef(0);

  useEffect(() => {
    lastMove.current = Date.now();

    const touch = () => {
      lastMove.current = Date.now();
      setShowing(false);
    };

    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "scroll",
      "wheel",
      "touchstart",
    ];
    for (const event of events) window.addEventListener(event, touch, { passive: true });

    /** Something playing is something happening, even with nobody touching the screen. */
    const mediaPlaying = () =>
      Array.from(document.querySelectorAll("video, audio")).some(
        (el) => !(el as HTMLMediaElement).paused && !(el as HTMLMediaElement).ended,
      );

    const limit = stage === "LEARN" ? READING_IDLE_MS : IDLE_MS;
    const id = setInterval(() => {
      if (document.hidden) return; // another tab is its own problem, not this one
      if (mediaPlaying()) {
        lastMove.current = Date.now();
        return;
      }
      const idle = Date.now() - lastMove.current;
      const sinceDismissed = Date.now() - dismissedAt.current;
      if (idle > limit && sinceDismissed > limit) setShowing(true);
    }, 5000);

    return () => {
      for (const event of events) window.removeEventListener(event, touch);
      clearInterval(id);
    };
  }, [stage]);

  if (!showing) return null;

  const name = studentName ? `${studentName}, ` : "";

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-line",
        "bg-surface-raised p-4 shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6",
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Hand className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-ink">
            {name}are you still with me?
          </p>
          <p className="text-sm text-ink-muted">
            Nothing&apos;s happened for a bit. If you&apos;re stuck, ask me — that&apos;s what
            I&apos;m here for. If you&apos;re not, let&apos;s get back to it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                dismissedAt.current = Date.now();
                lastMove.current = Date.now();
                setShowing(false);
                onWakeUp?.();
              }}
            >
              I&apos;m here
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
