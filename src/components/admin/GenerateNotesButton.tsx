"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Asks the teacher to write the subject notes, then saves the record as issued. */
export function GenerateNotesButton({ studentId }: { studentId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/record`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { reportId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "The notes could not be written just now.");
      if (data.reportId) router.push(`/admin/students/${studentId}/record?saved=${data.reportId}`);
      else router.refresh();
    } catch (err) {
      // A spinner that stops with nothing to show is a button that looks broken.
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={run} disabled={busy} variant="secondary">
        <PenLine className="mr-1.5 h-4 w-4" />
        {busy ? "Writing…" : "Write teacher's notes"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
