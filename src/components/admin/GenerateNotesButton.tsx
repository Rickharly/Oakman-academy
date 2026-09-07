"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Asks the teacher to write the subject notes, then saves the record as issued. */
export function GenerateNotesButton({ studentId }: { studentId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/record`, { method: "POST" });
      const data = (await res.json()) as { reportId?: string };
      if (data.reportId) router.push(`/admin/students/${studentId}/record?saved=${data.reportId}`);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={run} disabled={busy} variant="secondary">
      <PenLine className="mr-1.5 h-4 w-4" />
      {busy ? "Writing…" : "Write teacher's notes"}
    </Button>
  );
}
