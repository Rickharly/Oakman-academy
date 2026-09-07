import Link from "next/link";
import { BarChart3, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ReportGenerator } from "@/components/admin/ReportGenerator";
import { cn } from "@/lib/cn";
import { requireParent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { schoolDayKey, weekStartKey } from "@/lib/dates";
import type { ReportData } from "@/lib/reports/generate";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const parent = await requireParent();
  const { student: selectedParam } = await searchParams;

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: parent.id },
    include: { student: { include: { studentProfile: true } } },
    orderBy: { createdAt: "asc" },
  });
  const students = links.map((l) => l.student).filter((u) => u.studentProfile != null);

  if (students.length === 0) {
    return (
      <>
        <PageHeader title="Reports" />
        <EmptyState icon={BarChart3} title="No students yet" description="Add a student account from Settings first." />
      </>
    );
  }

  const selected = students.find((s) => s.studentProfile!.id === selectedParam) ?? students[0];
  const studentId = selected.studentProfile!.id;

  const reports = await prisma.report.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 12 });

  return (
    <>
      <style>{`@media print {
        aside, header.lg\\:hidden, .no-print { display: none !important; }
        main { padding: 0 !important; max-width: 100% !important; }
        body { background: #fff !important; }
      }`}</style>

      <PageHeader title="Reports" description="Weekly and monthly progress reports, ready to print." />

      {students.length > 1 ? (
        <div className="no-print mb-6 flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/admin/reports?student=${s.studentProfile!.id}`}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                s.studentProfile!.id === studentId
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line text-ink-muted hover:border-line-strong"
              )}
            >
              <Avatar emoji={s.avatar ?? "🙂"} size="sm" />
              {s.displayName}
            </Link>
          ))}
        </div>
      ) : null}

      <Card padding="lg" className="no-print mb-8">
        <ReportGenerator studentId={studentId} weekStartKey={weekStartKey(schoolDayKey())} />
      </Card>

      {reports.length === 0 ? (
        <EmptyState icon={BarChart3} title="No reports yet" description="Generate the first one above." />
      ) : (
        <div className="space-y-8">
          {reports.map((report) => {
            const data = report.data as unknown as ReportData;
            return (
              <Card key={report.id} padding="lg" className="space-y-5 print:border-0 print:shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">
                      {selected.displayName} — {report.period === "WEEKLY" ? "Weekly" : "Monthly"} report
                    </h2>
                    <p className="text-sm text-ink-muted">
                      {report.periodStart.toISOString().slice(0, 10)} – {report.periodEnd.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="no-print flex items-center gap-1.5 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-stone-200"
                    // Print CSS is scoped to this page; the browser print dialog does the rest.
                  >
                    <Printer className="h-3.5 w-3.5" /> Use your browser&apos;s print (⌘/Ctrl+P)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-muted">Lessons completed</p>
                    <p className="text-2xl font-semibold text-ink">{data.lessonsCompleted}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-muted">Study time</p>
                    <p className="text-2xl font-semibold text-ink">{data.studyTimeMinutes} min</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-muted">Average assessment</p>
                    <p className="text-2xl font-semibold text-ink">
                      {data.averageAssessmentPct != null ? `${Math.round(data.averageAssessmentPct)}%` : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1 rounded-xl bg-success-soft p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Strongest subject</p>
                    <p className="text-sm text-ink">
                      {data.strongestSubject
                        ? `${data.strongestSubject.subjectTitle} — ${Math.round(data.strongestSubject.averagePct)}%`
                        : "Not enough data yet"}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-xl bg-warning-soft p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Requires attention</p>
                    <p className="text-sm text-ink">
                      {data.weakestSubject
                        ? `${data.weakestSubject.subjectTitle} — ${Math.round(data.weakestSubject.averagePct)}%`
                        : "Nothing flagged this period"}
                    </p>
                  </div>
                </div>

                {data.subjects.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                          <th className="pb-2 font-medium">Subject</th>
                          <th className="pb-2 text-right font-medium">Average</th>
                          <th className="pb-2 text-right font-medium">Assessments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data.subjects.map((s) => (
                          <tr key={s.subjectId}>
                            <td className="py-2 text-ink">{s.subjectTitle}</td>
                            <td className="py-2 text-right tabular-nums text-ink">{Math.round(s.averagePct)}%</td>
                            <td className="py-2 text-right tabular-nums text-ink-muted">{s.activitiesGraded}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {data.reviewOutcomes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.reviewOutcomes.map((r) => (
                      <Badge key={r.reason} tone="neutral">
                        {r.reason.replace(/_/g, " ").toLowerCase()}: {r.count}
                        {r.averageScorePct != null ? ` (avg ${Math.round(r.averageScorePct)}%)` : ""}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {data.masteryMovement != null ? (
                  <p className="text-sm text-ink-muted">
                    Mastery moved {data.masteryMovement >= 0 ? "up" : "down"} by{" "}
                    {Math.abs(Math.round(data.masteryMovement * 100))} points this period.
                  </p>
                ) : null}

                {report.teacherSummary ? (
                  <div className="space-y-2 rounded-xl border border-line p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Teacher summary</p>
                    <p className="text-sm text-ink">{report.teacherSummary}</p>
                    {data.ai?.strengths?.length ? (
                      <p className="text-xs text-ink-muted">
                        <span className="font-medium text-ink">Strengths:</span> {data.ai.strengths.join(", ")}
                      </p>
                    ) : null}
                    {data.ai?.focus?.length ? (
                      <p className="text-xs text-ink-muted">
                        <span className="font-medium text-ink">Focus areas:</span> {data.ai.focus.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-ink-faint">Teacher summary unavailable for this report.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
