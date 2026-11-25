"use client";

import { useState } from "react";
import { SkipForward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * "Give me a setting where I can just click a new lesson for him."
 *
 * Closes the lesson the child is on and moves today's period to the next new lesson. Their
 * screen follows by itself within about 20 seconds.
 */
export function MoveToNextLesson({ studentId, name }: { studentId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function move() {
    if (busy) return;
    if (!window.confirm(`Move ${name} on to the next lesson now?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/next-lesson`, { method: "POST" });
      const data = (await res.json()) as { message?: string; error?: string };
      setMessage(data.message ?? data.error ?? (res.ok ? "Done." : "That didn't work."));
    } catch {
      setMessage("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={() => void move()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
        {busy ? "Moving…" : "Move to next lesson"}
      </Button>
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </div>
  );
}
