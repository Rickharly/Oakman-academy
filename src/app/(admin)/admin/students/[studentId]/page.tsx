import Link from "next/link";
import { AlertCircle, BookMarked, Clock, ArrowRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { GenerateSummaryButton } from "@/components/admin/GenerateSummaryButton";
import { requireParentOfStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getStudentOverview, getSubjectProgress, getWeakTopics } from "@/lib/progress/aggregate";
import { getTodayView, getWeekStrip } from "@/lib/scheduling/planner";
import { getDayEngagement } from "@/lib/engagement/service";
import { DayEngagement } from "@/components/admin/DayEngagement";
import { schoolDayKey } from "@/lib/dates";

const ASSIGNMENT_BADGE: Record<string, { status?: BadgeStatus; tone?: "neutral" | "warning" }> = {
  PLANNED: { tone: "neutral" },
  IN_PROGRESS: { status: "in-progress" },
  COMPLETED: { status: "completed" },
  SKIPPED: { tone: "neutral" },
  MOVED: { tone: "neutral" },
};

const WEEK_DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const STRIP_DOT: Record<string, string> = {
  done: "bg-success",
  partial: "bg-warning",
  planned: "bg-stone-300",
  none: "bg-stone-200",
  today: "bg-accent",
};

export default async function AdminStudentOverviewPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { student } = await requireParentOfStudent(studentId);

  const dateKey = schoolDayKey();
  const [overview, todayView, weekStrip, subjects, weakTopics, summaries, activity, engagement, readingEntries] =
    await Promise.all([
    getStudentOverview(studentId),
    getTodayView(studentId, dateKey),
    getWeekStrip(studentId, dateKey),
    getSubjectProgress(studentId),
    getWeakTopics(studentId, 5),
    prisma.dailySummary.findMany({ where: { studentId }, orderBy: { date: "desc" }, take: 5 }),
    prisma.activityLog.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 12 }),
    getDayEngagement(studentId, dateKey),
    prisma.readingEntry.findMany({
      where: { studentId },
      include: { readingText: { select: { title: true, genre: true } } },
      orderBy: { submittedAt: "desc" },
      take: 8,
    }),
  ]);

  const todaySummary = summaries.find((s) => s.date.toISOString().slice(0, 10) === dateKey) ?? null;

  return (
    <>
      <PageHeader
        title={student.user.displayName}
        description={`Year ${student.yearGroup} · ${student.keyStage.toUpperCase()}`}
        actions={
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/students/${studentId}/record`}
              className="flex h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors duration-150 hover:bg-stone-100"
            >
              <FileText className="h-4 w-4 text-ink-muted" />
              Academic record
            </Link>
            <Avatar emoji={student.user.avatar} name={student.user.displayName} size="lg" />
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card padding="md">
          <Stat label="Today" value={`${overview.today.done} / ${overview.today.total}`} />
        </Card>
        <Card padding="md">
          <Stat label="This week" value={`${overview.week.pct}%`} />
        </Card>
        <Card padding="md">
          <Stat label="Average mastery" value={overview.averageMastery != null ? `${Math.round(overview.averageMastery * 100)}%` : "—"} />
        </Card>
        <Card padding="md">
          <Stat label="Needs review" value={overview.needsReview} deltaTone={overview.needsReview > 0 ? "negative" : "neutral"} />
        </Card>
      </div>

      <div className="mb-8">
        <DayEngagement day={engagement} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Today</h2>
            <span className="text-sm text-ink-muted">{todayView.totalMinutes} min planned</span>
          </div>
          {todayView.assignments.length === 0 ? (
            <EmptyState title="Nothing planned today" description="Weekends and days with no schedule show up empty." />
          ) : (
            <ul className="divide-y divide-line">
              {todayView.assignments.map((a) => {
                const badge = ASSIGNMENT_BADGE[a.status] ?? { tone: "neutral" as const };
                const title = a.lesson?.title ?? a.customTitle ?? "Assignment";
                return (
                  <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{title}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {a.lesson?.unit ? `${a.kind === "REVIEW" ? "Review" : "Lesson"}` : a.kind} · {a.estimatedMinutes} min
                      </p>
                    </div>
                    {badge.status ? <Badge status={badge.status} /> : <Badge tone={badge.tone}>{a.status}</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-semibold text-ink">This week</h2>
          <div className="flex items-center justify-between gap-2">
            {weekStrip.map((day, i) => (
              <div key={day.dateKey} className="flex flex-col items-center gap-1.5">
                <span className="text-xs text-ink-muted">{WEEK_DAY_LABEL[i]}</span>
                <span className={`h-3 w-3 rounded-full ${STRIP_DOT[day.state]}`} />
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-muted">
            {overview.week.done} of {overview.week.total} assignments complete this week.
          </p>
        </Card>
      </div>

      <Card padding="lg" className="mb-8 space-y-4">
        <h2 className="text-base font-semibold text-ink">Subjects</h2>
        {subjects.length === 0 ? (
          <EmptyState title="Not enrolled in any subjects" description="Enrol this student in a programme via curriculum sync." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="pb-2 font-medium">Subject</th>
                  <th className="pb-2 font-medium">Completion</th>
                  <th className="pb-2 pr-0 text-right font-medium">Mastery</th>
                  <th className="pb-2 pl-4 text-right font-medium">Lessons</th>
                  <th className="pb-2 pl-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {subjects.map((s) => (
                  <tr key={s.subject.id}>
                    <td className="py-3 font-medium text-ink">{s.subject.title}</td>
                    <td className="py-3 pr-6">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={s.completionPct} size="sm" className="w-28" />
                        <span className="text-xs text-ink-muted">{s.completionPct}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-right tabular-nums text-ink">
                      {s.mastery != null ? `${Math.round(s.mastery * 100)}%` : "—"}
                    </td>
                    <td className="py-3 pl-4 text-right tabular-nums text-ink-muted">
                      {s.lessonsDone} / {s.lessonsTotal}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <Link
                        href={`/admin/students/${studentId}/subjects/${s.subject.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                      >
                        View <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card padding="lg" className="space-y-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <AlertCircle className="h-4 w-4 text-warning" /> Weak topics
          </h2>
          {weakTopics.length === 0 ? (
            <EmptyState title="No weak topics yet" description="Mastery data will appear as the student completes more lessons." />
          ) : (
            <ul className="space-y-3">
              {weakTopics.map((t) => (
                <li key={t.lesson.id}>
                  <Link
                    href={`/admin/students/${studentId}/lessons/${t.lesson.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 -mx-2 hover:bg-stone-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{t.lesson.title}</p>
                      <p className="truncate text-xs text-ink-muted">{t.subject.title}</p>
                    </div>
                    <Badge tone="warning">{Math.round(t.mastery * 100)}%</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Daily summaries</h2>
            {!todaySummary ? <GenerateSummaryButton studentId={studentId} dateKey={dateKey} /> : null}
          </div>
          {summaries.length === 0 ? (
            <EmptyState title="No summaries yet" description="Generate today's summary to get started." />
          ) : (
            <ul className="space-y-4">
              {summaries.map((s) => (
                <li key={s.id} className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{s.date.toISOString().slice(0, 10)}</p>
                  <p className="text-sm text-ink">{s.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card padding="lg" className="space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <BookMarked className="h-4 w-4 text-ink-muted" /> Reading &amp; writing
        </h2>
        {readingEntries.length === 0 ? (
          <EmptyState title="Nothing written yet" description="Reading responses will appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {readingEntries.map((entry) => (
              <li key={entry.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{entry.readingText.title}</span>
                  {entry.kind === "ESSAY" ? <Badge tone="warning">Essay</Badge> : null}
                  {entry.score != null && entry.maxScore != null ? (
                    <Badge tone="neutral">
                      {entry.score} / {entry.maxScore}
                    </Badge>
                  ) : null}
                  <span className="ml-auto shrink-0 text-xs text-ink-muted">
                    {entry.submittedAt.toLocaleString("en-GB")}
                  </span>
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{entry.prompt}</p>
                <p className="whitespace-pre-wrap text-sm text-ink">{entry.response}</p>
                {entry.feedback ? (
                  <p className="rounded-2xl bg-stone-50 p-3 text-sm text-ink-muted">
                    <span className="font-medium text-ink">Teacher: </span>
                    {entry.feedback}
                  </p>
                ) : null}
                {entry.reasoning ? (
                  <p className="text-xs text-ink-faint">Marker&apos;s note: {entry.reasoning}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Clock className="h-4 w-4 text-ink-muted" /> Recent activity
        </h2>
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="divide-y divide-line">
            {activity.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-ink">{log.kind.replace(/_/g, " ")}</span>
                <span className="shrink-0 text-xs text-ink-muted">{log.createdAt.toLocaleString("en-GB")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
