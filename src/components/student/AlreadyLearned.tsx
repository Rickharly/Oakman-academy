"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

/**
 * "I've already learned this."
 *
 * When the app sets a lesson a child has already sat through, they have had two options: do it
 * all again, or argue about it with a parent who has no way to check. Both cost a morning, and
 * the app is the one that got it wrong.
 *
 * So they can say so. It takes the lesson off their day and sends it to be looked at — with
 * what the app already knows about whether they really have done it before, so nobody has to
 * take anyone's word for it. Saying it is not a way of getting out of work: it goes straight to
 * a person, and the child is told so plainly rather than being caught out later.
 */
export function AlreadyLearned({
  lessonId,
  assignmentId,
  lessonTitle,
}: {
  lessonId: string;
  assignmentId?: string | null;
  lessonTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/already-known`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignmentId ?? null, note: note.trim() || null }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      setDone(
        res.ok
          ? (data.message ?? "Alright — that one is off your day.")
          : "I couldn't do that just now. Tell a grown-up and carry on with the rest of your day.",
      );
    } catch {
      setDone("I couldn't do that just now. Tell a grown-up and carry on with the rest of your day.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink-muted transition-colors duration-150 hover:bg-stone-100 hover:text-ink"
      >
        <CheckCheck className="h-4 w-4" />
        I&apos;ve already learned this
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} side="bottom" title="Already done this one?">
        <div className="space-y-4 pb-2">
          {done ? (
            <div className="space-y-3">
              <p className="text-base font-medium text-ink">{done}</p>
              <Button onClick={() => router.push("/today")}>Back to Today</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink">
                If you have already been taught <span className="font-medium">{lessonTitle}</span>,
                you don&apos;t have to sit through it again. I&apos;ll take it off your day.
              </p>
              <p className="text-xs text-ink-muted">
                Your teacher gets told, and checks — so only say it if it&apos;s true. If the app
                set it twice by mistake, that is worth knowing about and I&apos;ll go and fix it.
              </p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="When did you do it? (you can leave this blank)"
                className="w-full"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void send()} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {sending ? "Just a second…" : "Yes, I've done this one"}
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  No, I&apos;ll do the lesson
                </Button>
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
