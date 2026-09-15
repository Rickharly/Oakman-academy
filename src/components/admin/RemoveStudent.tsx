"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Permanently deletes a student's account and every row of their learning history.
 *
 * Deliberately harder to reach than `ResetProgress`, which sits in the ordinary run of buttons
 * on this page: this one is set apart in its own "danger zone" block, below a visible
 * separator, so a mis-tap aimed at "Reset PIN" or "Show the welcome again" cannot land here.
 * Opening it only reveals a warning and a name field — nothing destructive fires until the
 * child's exact name is typed back.
 */
export function RemoveStudent({ studentId, name }: { studentId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove this account.");
      setOpen(false);
      setConfirm("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3 border-t-2 border-dashed border-danger/30 pt-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-danger">
        <AlertTriangle className="h-3.5 w-3.5" />
        Danger zone
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 items-center gap-1.5 rounded-full border border-danger/30 px-4 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft"
        >
          <Trash2 className="h-4 w-4" />
          Remove {name}&apos;s account
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border-2 border-danger/40 bg-danger-soft/40 p-4">
          <p className="text-sm text-ink">
            This permanently erases <span className="font-medium">{name}</span>&apos;s whole
            record — their login, every lesson attempt, quiz answer, reading response, report and
            everything else tied to their account. There is no reset for this: once it is gone,
            it is gone.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Type <span className="font-semibold text-ink">{name}</span> to confirm
              </label>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={name} />
            </div>
            <Button onClick={run} disabled={busy || !confirm.trim()} variant="danger">
              {busy ? "Removing…" : "Remove account permanently"}
            </Button>
            <Button variant="ghost" onClick={() => { setOpen(false); setConfirm(""); setError(null); }}>
              Cancel
            </Button>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
