"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
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
  const [pending, setPending] = useState<"one" | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);

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
        <Button disabled={pending !== null || !subjectSlug} onClick={syncOne}>
          <RefreshCw className="h-4 w-4" /> Sync
        </Button>
        <Button variant="secondary" disabled={pending !== null} onClick={syncAll}>
          Sync everything
        </Button>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
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
