"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { RemovalSummary } from "@/lib/admin/remove";

/** One line of the post-removal summary: "N {singular|plural}". Omitted entirely when N is 0. */
function line(count: number, singular: string, plural: string): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Turns a `RemovalSummary` into the handful of sentences a parent actually wants to read —
 * not the twenty-odd raw counts the route returns. Zero-valued fields are dropped rather than
 * listed, and when literally nothing was ever recorded (the common case for the test accounts
 * this feature exists for) that is said outright instead of showing an empty list.
 */
function describeRemoval(summary: RemovalSummary): string {
  const parts = [
    line(summary.lessonAttempts, "lesson attempted", "lessons attempted"),
    line(summary.questionAttempts, "question answered", "questions answered"),
    line(summary.readingEntries, "reading response", "reading responses"),
    line(summary.conversations, "conversation with the teacher", "conversations with the teacher"),
    line(summary.schoolDays, "day of school recorded", "days of school recorded"),
    line(summary.reports, "report", "reports"),
  ].filter((p): p is string => p !== null);

  const everythingElse =
    summary.lessonAttempts +
    summary.questionAttempts +
    summary.readingEntries +
    summary.conversations +
    summary.schoolDays +
    summary.reports +
    summary.assignments +
    summary.progress +
    summary.masteryRecords +
    summary.reviewItems +
    summary.observations +
    summary.feedback +
    summary.overrides +
    summary.dailySummaries +
    summary.focusEvents +
    summary.activityLogs +
    summary.understandingGaps +
    summary.generatedQuestions +
    summary.enrolments +
    summary.schedules;

  if (everythingElse === 0) {
    return "There was nothing to lose — this account had never actually been used.";
  }
  if (parts.length === 0) {
    return "It had some setup (a schedule, an enrolment) but no actual work recorded.";
  }
  return `It took with it ${parts.join(", ")}.`;
}

/**
 * Permanently deletes a student's account and every row of their learning history.
 *
 * Deliberately harder to reach than `ResetProgress`, which sits in the ordinary run of buttons
 * on this page: this one is set apart in its own "danger zone" block, below a visible
 * separator, so a mis-tap aimed at "Reset PIN" or "Show the welcome again" cannot land here.
 * Opening it only reveals a warning and a name field — nothing destructive fires until the
 * child's exact name is typed back.
 *
 * The route hands back a full `RemovalSummary` — every table it deleted from, counted before
 * the delete so nothing is inferred after the fact. Counting all that and then throwing it away
 * would defeat the point, so it is held in state and shown in place of the confirm form once
 * removal succeeds. `router.refresh()` is *not* called right away: that re-reads the parent's
 * student list, which no longer contains this student, and this whole card — summary included —
 * would vanish with it before anyone could read it. Instead the summary stays up, with its own
 * "Done" button, and refreshing the list is deferred to that click.
 */
export function RemoveStudent({ studentId, name }: { studentId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<RemovalSummary | null>(null);
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
      const data = (await res.json()) as ({ error?: string } & Partial<RemovalSummary>);
      if (!res.ok) throw new Error(data.error ?? "Could not remove this account.");
      setOpen(false);
      setConfirm("");
      setRemoved(data as RemovalSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this account.");
    } finally {
      setBusy(false);
    }
  }

  if (removed) {
    return (
      <div className="mt-6 space-y-3 rounded-2xl border-2 border-line bg-surface-raised p-4">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          {removed.displayName}&apos;s account has been removed.
        </p>
        <p className="text-sm text-ink-muted">{describeRemoval(removed)}</p>
        <Button variant="secondary" onClick={() => router.refresh()}>
          Done
        </Button>
      </div>
    );
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
