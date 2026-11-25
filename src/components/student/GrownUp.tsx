"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * The parent's control, on the child's own tablet.
 *
 * "If he comes to me and he's stuck, I just press a button and he moves to the next lesson,
 * under my control." Always on screen, including inside a locked period — the one door the
 * lock never hides — and it does nothing without the parent's password.
 */
export function GrownUp() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "next-lesson" | "end-period">(null);
  const [message, setMessage] = useState<string | null>(null);

  async function act(action: "next-lesson" | "end-period") {
    if (busy) return;
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch("/api/student/grown-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, action }),
      });
      const data = (await res.json()) as { message?: string; error?: string; href?: string };
      if (!res.ok) {
        setMessage(data.error ?? "That didn't work.");
        return;
      }
      setMessage(data.message ?? "Done.");
      // A full load, so nothing the locked page remembered survives.
      window.location.href = data.href ?? "/today";
    } catch {
      setMessage("Couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMessage(null);
        }}
        className="fixed bottom-24 left-3 z-40 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-raised px-3 text-xs font-medium text-ink-muted shadow-sm md:bottom-4"
        aria-label="Grown-up controls"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Grown-up
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} side="bottom" title="Grown-up controls">
        <form
          className="space-y-4 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act("next-lesson");
          }}
        >
          <p className="text-sm text-ink">Enter the parent password (the one for Admin).</p>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parent password"
            className="w-full"
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!password || busy !== null}>
              {busy === "next-lesson" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Next lesson
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!password || busy !== null}
              onClick={() => void act("end-period")}
            >
              {busy === "end-period" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              End this period
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Next lesson: closes this lesson and starts the next new one in the same period. End
            this period: stops the clock and goes on to the next period.
          </p>
          {message ? <p className="text-sm text-ink">{message}</p> : null}
        </form>
      </Sheet>
    </>
  );
}
