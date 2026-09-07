"use client";

import { useState } from "react";
import { BookMarked, BookOpen, CheckCircle2, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { Confetti } from "./Confetti";

/**
 * What a child sees the very first time they log in: a short welcome that explains the four
 * things they need to know, and nothing else.
 *
 * Written to be read by the child, not the parent — short sentences, plain words, no jargon.
 * Dismissing it records the fact on the server so it never reappears.
 */
type WelcomeOverlayProps = {
  firstName: string;
  /** Year 5 gets slightly warmer, simpler wording than Year 7. */
  yearGroup: number;
  /** When false the overlay still renders, but dismissing it is not persisted (preview mode). */
  persist?: boolean;
};

const STEPS = [
  {
    icon: BookOpen,
    title: "Today is your school day",
    body: "Every morning this page shows the lessons waiting for you. Tap Start on the first one and work down the list.",
  },
  {
    icon: CheckCircle2,
    title: "Each lesson has five steps",
    body: "A warm-up, the teaching, some practice, a quiz, then your feedback. The bar at the top shows how far along you are.",
  },
  {
    icon: BookMarked,
    title: "Reading finishes the day",
    body: "After the lessons there's something to read and a few sentences to write about it. Your teacher writes back every time.",
  },
  {
    icon: MessageCircle,
    title: "Your teacher is always there",
    body: "Stuck? Ask the teacher panel anything, in your own words. It already knows which lesson you're on, so just say what's confusing.",
  },
  {
    icon: TrendingUp,
    title: "Getting it wrong is fine",
    body: "You can try again, and anything tricky comes back later so it sticks. Progress shows how you're doing over time.",
  },
];

export function WelcomeOverlay({ firstName, yearGroup, persist = true }: WelcomeOverlayProps) {
  const [open, setOpen] = useState(true);

  async function dismiss() {
    setOpen(false);
    if (!persist) return;
    try {
      await fetch("/api/student/welcome", { method: "POST" });
    } catch {
      // If this fails the welcome simply shows once more — not worth interrupting the child.
    }
  }

  if (!open) return null;

  return (
    <>
      <Confetti />
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-4 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-surface-raised p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <LogoMark size={56} />
            <h1 id="welcome-title" className="mt-4 text-2xl font-semibold tracking-tight text-ink">
              Welcome, {firstName}.
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              {yearGroup <= 5
                ? "This is your school. Here's how it works — it only takes a minute."
                : "This is your school. Here's how it works."}
            </p>
          </div>

          <ol className="mt-7 space-y-4">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                    <Icon className="h-4.5 w-4.5 text-accent" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-7 flex items-center justify-center gap-2 rounded-2xl bg-gold-soft px-4 py-3">
            <Sparkles className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
            <p className="text-sm text-gold-ink">
              {yearGroup <= 5 ? "Take your time. There's no rush." : "Work at your own pace — nothing here is timed."}
            </p>
          </div>

          <Button size="lg" className="mt-6 w-full" onClick={dismiss}>
            Let&apos;s start
          </Button>
        </div>
      </div>
    </>
  );
}
