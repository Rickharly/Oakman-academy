"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * The next topic, starting by itself.
 *
 * A button the child has to choose to press is a button a child who would rather stop does
 * not press. The period still has time on it, so the next topic begins after a short pause to
 * read how the last one went — or straight away if they press.
 */
export function AutoNext({
  href,
  label,
  seconds = 15,
  paused = false,
}: {
  href: string;
  label: string;
  seconds?: number;
  /** Held while they have asked for something else first (more practice being written). */
  paused?: boolean;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (left === 0) router.push(href);
  }, [left, href, router]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button href={href}>{label}</Button>
      <span className="text-sm text-ink-muted" aria-live="polite">
        {paused ? "Waiting for your practice…" : `Starting by itself in ${left}s`}
      </span>
    </div>
  );
}
