"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X, Repeat, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type Rule = { subjectId: string; weeklyFrequency: number; preferredDays: number[] };
type Assignment = {
  id: string;
  dateKey: string;
  kind: string;
  status: string;
  title: string;
  estimatedMinutes: number;
  optional: boolean;
  lessonId: string | null;
};

export function ScheduleEditor({
  studentId,
  subjects,
  initialRules,
  weekKeys,
  assignments,
  lessons,
}: {
  studentId: string;
  subjects: { id: string; title: string }[];
  initialRules: Rule[];
  weekKeys: string[];
  assignments: Assignment[];
  lessons: { id: string; title: string }[];
}) {
  const router = useRouter();
  const ruleBySubject = new Map(initialRules.map((r) => [r.subjectId, r]));

  const [rules, setRules] = useState<Record<string, { weeklyFrequency: number; preferredDays: Set<number> }>>(
    Object.fromEntries(
      subjects.map((s) => {
        const existing = ruleBySubject.get(s.id);
        return [s.id, { weeklyFrequency: existing?.weeklyFrequency ?? 0, preferredDays: new Set(existing?.preferredDays ?? []) }];
      })
    )
  );

  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState(weekKeys[0]);
  const [addTitle, setAddTitle] = useState("");
  const [addInstructions, setAddInstructions] = useState("");
  const [addMinutes, setAddMinutes] = useState("30");
  const [addLessonId, setAddLessonId] = useState("");

  function setFrequency(subjectId: string, weeklyFrequency: number) {
    setRules((r) => ({ ...r, [subjectId]: { ...r[subjectId], weeklyFrequency } }));
  }
  function toggleDay(subjectId: string, day: number) {
    setRules((r) => {
      const next = new Set(r[subjectId].preferredDays);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return { ...r, [subjectId]: { ...r[subjectId], preferredDays: next } };
    });
  }

  async function saveSchedule() {
    setPending("save");
    setError(null);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          rules: subjects.map((s) => ({
            subjectId: s.id,
            weeklyFrequency: rules[s.id].weeklyFrequency,
            preferredDays: [...rules[s.id].preferredDays],
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save the schedule");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  async function replan() {
    setPending("replan");
    setError(null);
    try {
      const res = await fetch("/api/admin/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, date: weekKeys[0] }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not re-plan this week");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  async function postAssignment(body: Record<string, unknown>, label: string) {
    setPending(label);
    setError(null);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, ...body }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That action failed");
      router.refresh();
      setAddOpen(false);
      setAddTitle("");
      setAddInstructions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  const byDay = new Map(weekKeys.map((k) => [k, assignments.filter((a) => a.dateKey === k)]));

  return (
    <div>
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">Weekly frequency</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={pending !== null} onClick={replan}>
              <RefreshCw className="h-4 w-4" /> Re-plan this week
            </Button>
            <Button disabled={pending !== null} onClick={saveSchedule}>
              Save
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="pb-2 font-medium">Subject</th>
                <th className="pb-2 font-medium">Lessons / week</th>
                <th className="pb-2 font-medium">Preferred days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 pr-4 font-medium text-ink">{s.title}</td>
                  <td className="py-3 pr-4">
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      value={rules[s.id].weeklyFrequency}
                      onChange={(e) => setFrequency(s.id, Math.max(0, Math.min(5, Number(e.target.value))))}
                      className="h-9 w-20"
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1.5">
                      {DAY_LABELS.map((label, i) => {
                        const day = i + 1;
                        const active = rules[s.id].preferredDays.has(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(s.id, day)}
                            className={cn(
                              "h-8 w-10 rounded-lg text-xs font-medium transition-colors",
                              active ? "bg-accent text-white" : "bg-stone-100 text-ink-muted hover:bg-stone-200"
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>

      <div className="border-t border-line p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">This week&apos;s plan</h2>
          <Button variant="secondary" onClick={() => setAddOpen((v) => !v)}>
            <Plus className="h-4 w-4" /> Add custom assignment
          </Button>
        </div>

        {addOpen ? (
          <div className="space-y-3 rounded-2xl border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-muted">Day</label>
                <select
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                >
                  {weekKeys.map((k, i) => (
                    <option key={k} value={k}>
                      {DAY_LABELS[i]} ({k})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-muted">Minutes</label>
                <Input type="number" min={5} value={addMinutes} onChange={(e) => setAddMinutes(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Title</label>
              <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="e.g. Times tables practice" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Instructions (optional)</label>
              <Textarea rows={2} value={addInstructions} onChange={(e) => setAddInstructions(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Attach a lesson (optional)</label>
              <select
                value={addLessonId}
                onChange={(e) => setAddLessonId(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              >
                <option value="">None</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
            <Button
              disabled={pending !== null || addTitle.trim().length === 0}
              onClick={() =>
                postAssignment(
                  {
                    action: "add",
                    dateKey: addDate,
                    title: addTitle,
                    instructions: addInstructions || undefined,
                    estimatedMinutes: Number(addMinutes),
                    lessonId: addLessonId || undefined,
                  },
                  "add"
                )
              }
            >
              Add assignment
            </Button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-5">
          {weekKeys.map((key, i) => {
            const items = byDay.get(key) ?? [];
            return (
              <div key={key} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {DAY_LABELS[i]} <span className="font-normal normal-case text-ink-faint">{key}</span>
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-ink-faint">Nothing planned</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((a) => (
                      <div key={a.id} className="space-y-2 rounded-xl border border-line p-2.5">
                        <p className="text-xs font-medium text-ink">{a.title}</p>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge tone={a.status === "COMPLETED" ? "success" : a.status === "SKIPPED" ? "neutral" : "accent"}>
                            {a.status}
                          </Badge>
                          <span className="text-[11px] text-ink-faint">{a.estimatedMinutes}m</span>
                        </div>
                        {a.status !== "COMPLETED" && a.status !== "SKIPPED" ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={pending !== null}
                              onClick={() => postAssignment({ action: "skip", assignmentId: a.id }, `skip-${a.id}`)}
                              className="inline-flex h-7 items-center gap-1 rounded-md bg-stone-100 px-2 text-[11px] font-medium text-ink-muted hover:bg-stone-200"
                            >
                              <X className="h-3 w-3" /> Skip
                            </button>
                            <select
                              disabled={pending !== null}
                              defaultValue=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                postAssignment({ action: "move", assignmentId: a.id, toDateKey: e.target.value }, `move-${a.id}`);
                                e.target.value = "";
                              }}
                              className="h-7 rounded-md border border-line bg-surface-raised px-1.5 text-[11px] text-ink-muted"
                            >
                              <option value="" disabled>
                                Move to…
                              </option>
                              {weekKeys
                                .filter((k) => k !== key)
                                .map((k, wi) => (
                                  <option key={k} value={k}>
                                    {DAY_LABELS[weekKeys.indexOf(k)] ?? wi}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : null}
                        {a.lessonId ? (
                          <button
                            type="button"
                            disabled={pending !== null}
                            onClick={() =>
                              postAssignment({ action: "repeat", lessonId: a.lessonId, dateKey: key }, `repeat-${a.id}`)
                            }
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-stone-100 px-2 text-[11px] font-medium text-ink-muted hover:bg-stone-200"
                          >
                            <Repeat className="h-3 w-3" /> Repeat today
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {assignments.length === 0 ? <EmptyState title="No assignments this week" description="Save a schedule and re-plan to generate one." /> : null}
      </div>
    </div>
  );
}
