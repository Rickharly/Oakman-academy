"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Clears a child's work so a test run can start clean.
 *
 * Behind a typed confirmation on purpose: everywhere else in this app, learning history is
 * permanent. This is the exception, and it should feel like one.
 */
export function ResetProgress({ studentId, name }: { studentId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not reset.");
      setOpen(false);
      setConfirm("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center gap-1.5 rounded-full border border-danger/30 px-4 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft"
      >
        <RotateCcw className="h-4 w-4" />
        Reset {name}&apos;s progress
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger-soft/40 p-4">
      <p className="text-sm text-ink">
        This deletes every lesson attempt, quiz answer, reading response and report for{" "}
        <span className="font-medium">{name}</span>, and shows the welcome again on their next
        login. Their account, PIN and timetable stay. It cannot be undone.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Type <span className="font-semibold text-ink">{name}</span> to confirm
          </label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={name} />
        </div>
        <Button onClick={run} disabled={busy || !confirm.trim()} variant="danger">
          {busy ? "Resetting…" : "Reset everything"}
        </Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setError(null); }}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
