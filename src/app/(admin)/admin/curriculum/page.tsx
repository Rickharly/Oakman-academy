import Link from "next/link";
import { Library, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SyncPanel } from "@/components/admin/SyncPanel";
import { requireParent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getCurriculumProvider, type CurriculumProvider } from "@/lib/curriculum/provider";
import { createOakClient, getRateLimit, type OakRateLimit } from "@/lib/oak/client";
import { SCHOOL_TIMEZONE } from "@/lib/dates";

/**
 * How much Oak quota is left. Oak grants a windowed budget rather than a rate, so knowing what
 * remains is the difference between syncing a subject that will finish and starting one that
 * dies half way.
 */
async function readOakQuota(): Promise<OakRateLimit | null> {
  const apiKey = process.env.OAK_API_KEY;
  if (!apiKey) return null;
  try {
    return await getRateLimit(createOakClient({ apiKey }));
  } catch {
    return null;
  }
}

const JOB_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  PENDING: "neutral",
  RUNNING: "accent",
  SUCCESS: "success",
  // Stopped on the provider's quota, not broken: everything imported was kept.
  PARTIAL: "warning",
  FAILED: "danger",
};

export default async function AdminCurriculumPage() {
  await requireParent();

  let provider: CurriculumProvider | null = null;
  let providerError: string | null = null;
  try {
    provider = getCurriculumProvider();
  } catch (err) {
    providerError = err instanceof Error ? err.message : String(err);
  }

  let subjectOptions: { slug: string; title: string }[] = [];
  if (provider) {
    try {
      subjectOptions = await provider.getSubjects();
    } catch {
      // Best-effort only — the sync form just shows no subjects if the provider can't be reached.
    }
  }

  const [programmes, units, lessonsByLicence, jobs, lessonsByProvider, quota] = await Promise.all([
    prisma.programme.findMany({ include: { subject: true, _count: { select: { units: true } } }, orderBy: [{ yearGroup: "asc" }] }),
    prisma.unit.findMany({ select: { id: true, programmeId: true, _count: { select: { lessons: true } } } }),
    prisma.lesson.groupBy({ by: ["licence"], _count: { _all: true } }),
    prisma.curriculumSyncJob.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    // What is actually stored, which is not the same as what the provider is configured to be.
    prisma.lesson.groupBy({ by: ["provider"], _count: { _all: true } }),
    // Free to ask — Oak does not count this endpoint against the quota.
    readOakQuota(),
  ]);

  const lessonCountByProgramme = new Map<string, number>();
  for (const u of units) {
    lessonCountByProgramme.set(u.programmeId, (lessonCountByProgramme.get(u.programmeId) ?? 0) + u._count.lessons);
  }

  const usingOak = process.env.CURRICULUM_PROVIDER?.toLowerCase() === "oak";
  const oakKeySet = Boolean(process.env.OAK_API_KEY);

  const totalLessons = lessonsByProvider.reduce((n, row) => n + row._count._all, 0);
  const placeholderLessons = lessonsByProvider
    .filter((row) => row.provider !== "oak")
    .reduce((n, row) => n + row._count._all, 0);
  const placeholderSubjects = [
    ...new Set(
      programmes
        .filter((p) => p.provider !== "oak")
        .map((p) => `${p.subject.title} year ${p.yearGroup}`),
    ),
  ].sort();

  return (
    <>
      <PageHeader title="Curriculum" description="Imported programmes, units, and lessons." />

      {!usingOak || !oakKeySet ? (
        <Card padding="md" className="mb-6 flex items-start gap-3 border-warning-soft bg-warning-soft/40">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-sm text-ink">
            The bundled fixture curriculum is in use{providerError ? ` (${providerError})` : ""}. To sync real lessons from Oak,
            set <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">CURRICULUM_PROVIDER=oak</code> and{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">OAK_API_KEY</code> in your environment.
          </p>
        </Card>
      ) : (
        <Card
          padding="md"
          className={
            placeholderLessons > 0
              ? "mb-6 flex items-start gap-3 border-warning-soft bg-warning-soft/40"
              : "mb-6 flex items-center gap-3"
          }
        >
          <Info
            className={`mt-0.5 h-4 w-4 shrink-0 ${placeholderLessons > 0 ? "text-warning" : "text-accent"}`}
          />
          {/*
            What matters is what the children are actually being taught, not which provider the
            server is configured to use. Saying "synced from Oak" while every lesson in the
            database is a placeholder is how a parent ends up asking why their son is doing the
            Anglo-Saxons when Oak teaches Ancient Greece.
          */}
          {placeholderLessons > 0 ? (
            <div className="space-y-1 text-sm text-ink">
              <p className="font-medium">
                {placeholderLessons} of {totalLessons} lessons are still placeholder content, not
                Oak&apos;s.
              </p>
              <p className="text-ink-muted">
                Placeholder lessons were written to build the app before the Oak key arrived.
                They are short, have no video, and do not follow Oak&apos;s curriculum — so a
                topic here may not be the topic Oak actually teaches for that year. Sync a
                subject below to replace them.
              </p>
              {placeholderSubjects.length > 0 ? (
                <p className="text-ink-muted">
                  Still on placeholders: {placeholderSubjects.join(", ")}.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink">
              All {totalLessons} lessons come from Oak National Academy.
            </p>
          )}
        </Card>
      )}

      <Card padding="lg" className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Sync now</h2>
          {quota ? (
            <p className="text-sm text-ink-muted">
              Oak quota: <span className="font-medium text-ink">{quota.remaining.toLocaleString()}</span>{" "}
              of {quota.limit.toLocaleString()} requests left
              {quota.remaining < 200 ? (
                <span className="text-warning">
                  {" "}
                  — resets at{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    timeZone: SCHOOL_TIMEZONE,
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(quota.reset))}
                </span>
              ) : null}
              . A lesson costs about 5 requests, so a batch of 25 lessons costs roughly 125.
              Lessons already imported are skipped and cost nothing.
            </p>
          ) : null}
          <span className="text-xs text-ink-muted">Provider: {provider?.name ?? "unavailable"}</span>
        </div>
        {subjectOptions.length === 0 ? (
          <p className="text-sm text-ink-muted">No subjects available from the current provider.</p>
        ) : (
          <SyncPanel subjectOptions={subjectOptions} />
        )}
      </Card>

      <Card padding="lg" className="mb-6 space-y-4">
        <h2 className="text-base font-semibold text-ink">Imported programmes</h2>
        {programmes.length === 0 ? (
          <EmptyState icon={Library} title="Nothing imported yet" description="Run a sync above to import curriculum content." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="pb-2 font-medium">Programme</th>
                  <th className="pb-2 text-right font-medium">Units</th>
                  <th className="pb-2 text-right font-medium">Lessons</th>
                  <th className="pb-2 text-right font-medium">Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {programmes.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 font-medium text-ink">{p.title}</td>
                    <td className="py-3 text-right tabular-nums text-ink-muted">{p._count.units}</td>
                    <td className="py-3 text-right tabular-nums text-ink-muted">{lessonCountByProgramme.get(p.id) ?? 0}</td>
                    <td className="py-3 text-right text-xs text-ink-muted">
                      {p.syncedAt ? p.syncedAt.toLocaleDateString("en-GB") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Licence status</h2>
          {lessonsByLicence.length === 0 ? (
            <p className="text-sm text-ink-muted">No lessons imported yet.</p>
          ) : (
            <ul className="space-y-2">
              {lessonsByLicence.map((l) => (
                <li key={l.licence} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{l.licence.replace(/_/g, " ")}</span>
                  <span className="tabular-nums text-ink-muted">{l._count._all}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Recent sync jobs</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-ink-muted">No sync jobs yet.</p>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => (
                <li key={job.id} className="space-y-1 rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink">
                      {(job.scope as { subjectSlug?: string; yearGroup?: number })?.subjectSlug ?? "all"} ·{" "}
                      {(job.scope as { yearGroup?: number })?.yearGroup ?? "—"}
                    </span>
                    <Badge tone={JOB_TONE[job.status]}>{job.status}</Badge>
                  </div>
                  {Object.keys((job.stats as Record<string, number>) ?? {}).length > 0 ? (
                    <p className="text-xs text-ink-muted">
                      {Object.entries(job.stats as Record<string, number>)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {job.error ? <p className="text-xs text-danger">{job.error}</p> : null}
                  {job.log ? (
                    <details>
                      <summary className="cursor-pointer text-xs text-ink-muted">Log</summary>
                      <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px] text-ink-muted">{job.log}</pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-xs text-ink-faint">
        Browse a lesson&apos;s source content from a student&apos;s subject page, or{" "}
        <Link href="/admin/students" className="text-accent hover:underline">
          go to Students
        </Link>
        .
      </p>
    </>
  );
}
