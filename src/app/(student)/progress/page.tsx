import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { addDaysKey, schoolDayEnd, schoolDayKey, schoolDayStart, weekStartKey } from "@/lib/dates";
import { getTodayView, getWeekStrip } from "@/lib/scheduling/planner";
import { getSubjectProgress } from "@/lib/progress/aggregate";
import { getReviewQueue } from "@/lib/progress/review";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { subjectTheme } from "@/components/student/subjectTheme";
import { formatMinutes } from "@/components/student/format";
import { cn } from "@/lib/cn";

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const DOT_CLASSES: Record<"done" | "partial" | "planned" | "none" | "today", string> = {
  done: "bg-success text-white",
  partial: "bg-warning text-white",
  planned: "bg-stone-200 text-ink-muted",
  none: "bg-stone-100 text-ink-faint",
  today: "bg-accent text-white ring-2 ring-accent-soft ring-offset-2 ring-offset-surface",
};

export default async function ProgressPage() {
  const user = await requireStudent();
  const studentId = user.studentProfile.id;
  const dateKey = schoolDayKey();
  const weekStart = weekStartKey(dateKey);

  const [strip, subjects, reviewItems, weekView] = await Promise.all([
    getWeekStrip(studentId, dateKey),
    getSubjectProgress(studentId),
    getReviewQueue(studentId, dateKey),
    getTodayView(studentId, dateKey),
  ]);

  const weekRangeStart = schoolDayStart(weekStart);
  const weekRangeEnd = schoolDayEnd(addDaysKey(weekStart, 4));

  const [timeAgg, scoredProgress, reviewLessons] = await Promise.all([
    prisma.lessonAttempt.aggregate({
      where: { studentId, startedAt: { gte: weekRangeStart, lt: weekRangeEnd } },
      _sum: { timeSpentSeconds: true },
    }),
    prisma.studentLessonProgress.findMany({
      where: { studentId, lastActivityAt: { gte: weekRangeStart, lt: weekRangeEnd }, latestScorePct: { not: null } },
      select: { latestScorePct: true },
    }),
    reviewItems.length
      ? prisma.lesson.findMany({
          where: { id: { in: reviewItems.map((r) => r.lessonId) } },
          select: { id: true, title: true, unit: { select: { programme: { select: { subject: true } } } } },
        })
      : Promise.resolve([]),
  ]);

  const avgScore =
    scoredProgress.length > 0
      ? Math.round(scoredProgress.reduce((sum, p) => sum + (p.latestScorePct ?? 0), 0) / scoredProgress.length)
      : null;
  const lessonById = new Map(reviewLessons.map((l) => [l.id, l]));

  return (
    <div className="space-y-8">
      <PageHeader title="Progress" />

      <Card padding="lg" className="space-y-4">
        <p className="text-sm font-semibold text-ink">This week</p>
        <div className="flex justify-between gap-2 sm:gap-4">
          {strip.map((day, i) => (
            <Link
              key={day.dateKey}
              href={`/progress/${day.dateKey}`}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl py-2 transition-colors duration-150 hover:bg-stone-50"
            >
              <span className="text-xs font-medium text-ink-muted">{WEEKDAY_SHORT[i]}</span>
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
                  DOT_CLASSES[day.state],
                )}
              >
                {Number(day.dateKey.slice(-2))}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 sm:grid-cols-3">
        <Stat label="Lessons this week" value={`${weekView.completedWeek} / ${weekView.totalWeek}`} />
        <Stat label="Time spent" value={formatMinutes((timeAgg._sum.timeSpentSeconds ?? 0) / 60)} />
        <Stat label="Average score" value={avgScore != null ? `${avgScore}%` : "–"} />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">Subject mastery</p>
        {subjects.length === 0 ? (
          <EmptyState title="No subjects yet" />
        ) : (
          <div className="space-y-3">
            {subjects.map((s) => {
              const theme = subjectTheme(s.subject.slug);
              const masteryPct = s.mastery != null ? Math.round(s.mastery * 100) : 0;
              return (
                <Card key={s.subject.id} padding="md" className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn("font-medium", theme.text)}>{s.subject.title}</span>
                    <span className="text-ink-muted">{s.mastery != null ? `${masteryPct}%` : "Not started"}</span>
                  </div>
                  <ProgressBar value={masteryPct} barClassName={theme.bg} />
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">Things to review</p>
        {reviewItems.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Nothing to review" description="You're all caught up." />
        ) : (
          <div className="space-y-3">
            {reviewItems.map((item) => {
              const lesson = lessonById.get(item.lessonId);
              if (!lesson) return null;
              const theme = subjectTheme(lesson.unit.programme.subject.slug);
              return (
                <Link
                  key={item.id}
                  href={`/lessons/${lesson.id}`}
                  className="card card-hover flex items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0 space-y-1">
                    <span className={cn("text-xs font-semibold uppercase tracking-wide", theme.text)}>
                      {lesson.unit.programme.subject.title}
                    </span>
                    <p className="font-medium text-ink">{lesson.title}</p>
                    {item.detail ? <p className="text-sm text-ink-muted">{item.detail}</p> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
