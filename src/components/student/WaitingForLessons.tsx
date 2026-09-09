"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * Shown when a day came out short and the missing lessons are being fetched.
 *
 * A child sitting in front of a half-empty timetable needs two things: to know it is being
 * dealt with, and for it to fix itself without an adult being fetched. So this says what is
 * happening and reloads the page until the lessons appear.
 */
export function WaitingForLessons({ subjects }: { subjects: string[] }) {
  const router = useRouter();
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    // Every ten seconds for three minutes. Long enough for an import, short enough that nobody
    // sits looking at a stale page; after that it stops rather than reloading forever.
    if (waited > 18) return;
    const timer = setTimeout(() => {
      setWaited((n) => n + 1);
      router.refresh();
    }, 10_000);
    return () => clearTimeout(timer);
  }, [waited, router]);

  return (
    <Card padding="md" className="flex items-start gap-3 border-line bg-surface-raised">
      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent" />
      <div>
        <p className="text-sm font-medium text-ink">
          {waited > 18
            ? "Your other lessons still aren't ready."
            : "Getting the rest of your lessons ready…"}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted">
          {subjects.length > 0
            ? `${subjects.join(" and ")} ${subjects.length === 1 ? "is" : "are"} being fetched now. `
            : ""}
          {waited > 18
            ? "Tell whoever set today's lessons — this one needs a grown-up."
            : "Start the ones below; the rest will appear here on their own."}
        </p>
      </div>
    </Card>
  );
}
