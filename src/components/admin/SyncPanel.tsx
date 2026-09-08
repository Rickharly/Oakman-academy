"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

type JobStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
type Job = { id: string; status: JobStatus; stats: Record<string, number>; error: string | null; log: string | null };

const TONE: Record<JobStatus, "neutral" | "accent" | "success" | "danger"> = {
  PENDING: "neutral",
  RUNNING: "accent",
  SUCCESS: "success",
  FAILED: "danger",
};

function JobCard({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/admin/sync/${jobId}`);
        if (!res.ok) return;
        const { job: fetched } = await res.json();
        if (cancelled) return;
        setJob(fetched);
        if (fetched.status === "PENDING" || fetched.status === "RUNNING") {
          timer = setTimeout(poll, 1500);
        } else {
          router.refresh();
        }
      } catch {
        timer = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (!job) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-ink-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting sync…
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-xl border border-line px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink">Job {job.id.slice(0, 8)}</span>
        <Badge tone={TONE[job.status]}>{job.status}</Badge>
      </div>
      {Object.keys(job.stats ?? {}).length > 0 ? (
        <p className="text-xs text-ink-muted">
          {Object.entries(job.stats)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")}
        </p>
      ) : null}
      {job.error ? <p className="text-xs text-danger">{job.error}</p> : null}
    </div>
  );
}

export function SyncPanel({ subjectOptions }: { subjectOptions: { slug: string; title: string }[] }) {
  const [subjectSlug, setSubjectSlug] = useState(subjectOptions[0]?.slug ?? "");
  const [yearGroup, setYearGroup] = useState("7");
  // Batches, because Oak's quota is a fixed budget: a whole subject-year rarely fits in one
  // window, and a run that dies half way is worse than three runs that each finish.
  const [maxLessons, setMaxLessons] = useState("25");
  const [pending, setPending] = useState<"one" | "all" | "week" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [weekSummary, setWeekSummary] = useState<string | null>(null);

  /**
   * The lessons the next fortnight of school will actually use, and nothing else.
   *
   * The timetable already knows what is coming — each subject's frequency, and the next
   * incomplete lesson in its sequence. Importing exactly that costs a fraction of a quota
   * window, where "the next 25 of everything" spends the lot on material nobody opens for a
   * month and still misses Tuesday's lesson.
   */
  async function syncWeek() {
    setPending("week");
    setError(null);
    setWeekSummary(null);
    try {
      const res = await fetch("/api/admin/sync/week", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start the weekly import");
      if (data.nothingToDo) {
        setWeekSummary("Every lesson the next two weeks need is already here.");
      } else {
        const total = (data.targets ?? []).reduce((n: number, t: { lessons: number }) => n + t.lessons, 0);
        setWeekSummary(
          `Importing ${total} lesson(s) across ${(data.targets ?? []).length} subject-year(s).` +
            ((data.failures ?? []).length > 0
              ? ` ${data.failures.length} failed — see the jobs below.`
              : ""),
        );
      }
      setJobIds((prev) => [...(data.jobIds ?? []), ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  async function syncOne() {
    setPending("one");
    setError(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectSlug, yearGroup: Number(yearGroup), maxLessons: Number(maxLessons) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Sync failed to start");
      const { jobId } = await res.json();
      setJobIds((ids) => [jobId, ...ids]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  async function syncAll() {
    setPending("all");
    setError(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, maxLessons: Math.max(1, Math.round(Number(maxLessons) / 3)) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Sync failed to start");
      const { jobIds: ids } = await res.json();
      setJobIds((prev) => [...ids, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Each lesson costs Oak roughly five requests, and the quota is a fixed budget per window
        — so import in batches. Lessons already imported are skipped, so running this again
        reaches further into the subject rather than starting over.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Subject</label>
          <select
            value={subjectSlug}
            onChange={(e) => setSubjectSlug(e.target.value)}
            className="h-11 rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          >
            {subjectOptions.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Year</label>
          <Input type="number" min={1} max={13} value={yearGroup} onChange={(e) => setYearGroup(e.target.value)} className="h-11 w-24" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Lessons this run</label>
          <Input
            type="number"
            min={1}
            max={500}
            value={maxLessons}
            onChange={(e) => setMaxLessons(e.target.value)}
            className="h-11 w-28"
          />
        </div>
        <Button variant="secondary" disabled={pending !== null || !subjectSlug} onClick={syncOne}>
          <RefreshCw className="h-4 w-4" /> Sync
        </Button>
        <Button variant="secondary" disabled={pending !== null} onClick={syncAll}>
          Sync everything
        </Button>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {/*
        The one a parent should normally press. It is separated from the manual controls above
        because those are for filling a subject in; this is the weekly job, and the weekly job
        is the one that keeps school running.
      */}
      <div className="space-y-2 rounded-2xl border border-line bg-accent-soft/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Get the next two weeks ready</p>
            <p className="text-xs text-ink-muted">
              Works out exactly which lessons each child will reach from their timetable, and
              imports only those — cheap enough to run every week.
            </p>
          </div>
          <Button disabled={pending !== null} onClick={syncWeek}>
            {pending === "week" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Importing…
              </>
            ) : (
              <>
                <CalendarCheck className="h-4 w-4" /> Import this fortnight
              </>
            )}
          </Button>
        </div>
        {weekSummary ? <p className="text-xs text-ink">{weekSummary}</p> : null}
      </div>
      {jobIds.length > 0 ? (
        <div className="space-y-2">
          {jobIds.map((id) => (
            <JobCard key={id} jobId={id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
