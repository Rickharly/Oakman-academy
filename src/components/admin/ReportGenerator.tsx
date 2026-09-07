"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ReportGenerator({ studentId, weekStartKey }: { studentId: string; weekStartKey: string }) {
  const router = useRouter();
  const [period, setPeriod] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, period, start: weekStartKey }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not generate the report");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value as "WEEKLY" | "MONTHLY")}
        className="h-11 rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      >
        <option value="WEEKLY">Weekly</option>
        <option value="MONTHLY">Monthly</option>
      </select>
      <Button disabled={pending} onClick={generate}>
        <Sparkles className="h-4 w-4" /> {pending ? "Generating…" : "Generate report"}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
