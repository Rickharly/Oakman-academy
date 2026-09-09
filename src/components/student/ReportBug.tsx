"use client";

import { useState } from "react";
import { Bug, Check, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

/**
 * "Something's wrong here" — from the person who can actually see it.
 *
 * Every fault this week reached the people who could fix it through a parent, relaying what a
 * child had said, hours later, with the details worn off. The child was the only witness and
 * had no way to say anything.
 *
 * So they can. Where they were is attached automatically — the lesson, the step, the question
 * in front of them — because "it didn't work" from an eight-year-old is a complete and
 * reasonable bug report if the app supplies the rest. Nothing is asked of them except what
 * they noticed.
 */
export function ReportBug({
  lessonTitle,
  subject,
  stage,
  questionPrompt,
}: {
  lessonTitle?: string;
  subject?: string;
  stage?: string;
  questionPrompt?: string;
}) {
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!what.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/student/report-bug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          what: what.trim(),
          lessonTitle,
          subject,
          stage,
          questionPrompt,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
    } catch {
      // Never told they failed. Reporting a problem must not become a second problem, and a
      // child who is told "could not send" learns not to bother next time.
    } finally {
      setSending(false);
      setSent(true);
      setWhat("");
    }
  }

  function close() {
    setOpen(false);
    // Reset a moment later so the thank-you is not swept away as the sheet closes.
    setTimeout(() => setSent(false), 400);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink-muted transition-colors duration-150 hover:bg-stone-100 hover:text-ink"
      >
        <Bug className="h-4 w-4" />
        Something&apos;s wrong here
      </button>

      <Sheet open={open} onClose={close} side="bottom" title="Tell us what's wrong">
        <div className="space-y-4 pb-2">
          {sent ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-success" />
                <p className="text-base font-medium text-ink">Thank you — that really helps.</p>
              </div>
              <p className="text-sm text-ink-muted">
                We know exactly which lesson and which question you were on, so we can go and look
                at it. Carry on with your day.
              </p>
              <Button onClick={close}>Back to my lesson</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink">
                What happened? Anything is useful — &quot;the picture is missing&quot;, &quot;the
                button does nothing&quot;, &quot;this question makes no sense&quot;.
              </p>
              <p className="text-xs text-ink-muted">
                You don&apos;t need to explain where you are. We already know.
              </p>
              <Textarea
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                rows={4}
                placeholder="Tell us in your own words…"
                autoFocus
                className="w-full"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void send()} disabled={sending || !what.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {sending ? "Sending…" : "Send it"}
                </Button>
                <Button variant="ghost" onClick={close}>
                  Never mind
                </Button>
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
