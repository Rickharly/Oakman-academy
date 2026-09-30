"use client";

import { useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * Finding out how far ahead a child is, rather than guessing.
 *
 * A child who gets everything right quickly has told you the work is too easy and nothing else.
 * This sets a paper that rises past what they have been taught and into next year, and reports
 * the band where they stopped — which is the level they should be taught at.
 */
type Band = { band: number; label: string; asked: number; right: number };
type Verdict = {
  name: string;
  title: string;
  grade: string | null;
  scorePct: number | null;
  bands: Band[];
  solidTo: number;
  brokeAt: number;
  recommendation: string;
};

const SUBJECTS = ["maths", "english", "science", "writing", "logic"];

export function FindTheirLevel({
  students,
}: {
  students: { id: string; name: string }[];
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [subject, setSubject] = useState("maths");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  useEffect(() => {
    // Fetched rather than set straight away: the verdict comes from the server, and the state
    // lands when it arrives. A verdict that will not load is not worth an error message beside
    // a button that still works.
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/admin/placement", { cache: "no-store" }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const data = await res.json().catch(() => null);
      if (!cancelled && data) setVerdicts(data.results ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function setPaper() {
    if (!studentId || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build the paper.");
      setMessage(`"${data.title}" is on their board for today.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not build the paper.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="md" className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Find their level</p>
        <p className="text-sm text-ink-muted">
          For a child who gets everything right and finishes early: a paper that starts behind
          them and rises past this year into the next, so you can see where they actually stop.
          They are told it is meant to be too hard at the end — getting stuck is the measurement,
          not a failure.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="min-h-11 rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="min-h-11 rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink"
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <Button onClick={() => void setPaper()} disabled={busy || !studentId}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
          {busy ? "Building…" : "Set the paper"}
        </Button>
      </div>

      {message ? <p className="text-sm text-ink">{message}</p> : null}

      {verdicts.length > 0 ? (
        <div className="space-y-3 pt-1">
          {verdicts.map((v) => (
            <div key={`${v.name}-${v.title}`} className="space-y-1.5 rounded-xl bg-stone-50 p-3">
              <p className="text-sm font-medium text-ink">
                {v.name} — {v.title}
                {v.grade ? ` · ${v.grade}` : ""}
              </p>
              <ul className="space-y-0.5 text-sm text-ink-muted">
                {v.bands.map((b) => (
                  <li key={b.band}>
                    {b.label}: {b.right}/{b.asked}
                    {b.band === v.brokeAt ? "  ← stopped here" : ""}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-ink">{v.recommendation}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
