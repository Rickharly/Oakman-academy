import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Sparkles } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { toDateOnly } from "@/lib/dates";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { subjectTheme } from "@/components/student/subjectTheme";
import { formatDateWords, formatMinutes, lessonStatusToBadge } from "@/components/student/format";
import { cn } from "@/lib/cn";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_KEY_RE.test(date)) notFound();

  const user = await requireStudent();
  const studentId = user.studentProfile.id;

  const assignments = await prisma.dailyAssignment.findMany({
    where: { studentId, date: toDateOnly(date) },
    orderBy: { order: "asc" },
    include: {
      lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } },
    },
  });

  const lessonIds = assignments.map((a) => a.lessonId).filter((id): id is string => Boolean(id));
  const progressRows = lessonIds.length
    ? await prisma.studentLessonProgress.findMany({ where: { studentId, lessonId: { in: lessonIds } } })
    : [];
  const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));

  const shown = assignments.filter((a) => a.status !== "MOVED");

  return (
    <>
      <PageHeader title={formatDateWords(date)} />

      {shown.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nothing was planned" description="No lessons were scheduled for this day." />
      ) : (
        <div className="space-y-3">
          {shown.map((assignment) => {
            const lesson = assignment.lesson;
            const subject = lesson?.unit.programme.subject;
            const theme = subjectTheme(subject?.slug);
            const progress = lesson ? progressByLesson.get(lesson.id) : undefined;
            const title = lesson?.title ?? assignment.customTitle ?? "Assignment";
            const score = progress?.latestScorePct;

            const content = (
              <div className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {subject ? (
                      <span className={cn("text-xs font-semibold uppercase tracking-wide", theme.text)}>
                        {subject.title}
                      </span>
                    ) : null}
                    {assignment.kind === "REVIEW" ? (
                      <Badge tone="warning">
                        <Sparkles className="h-3 w-3" /> Quick review
                      </Badge>
                    ) : null}
                  </div>
                  <p className="font-medium text-ink">{title}</p>
                  <p className="text-xs text-ink-muted">{formatMinutes(assignment.estimatedMinutes)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {progress ? <Badge status={lessonStatusToBadge(progress.status)} /> : <Badge status="not-started" />}
                  {score != null ? <span className="text-sm font-medium text-ink">{Math.round(score)}%</span> : null}
                </div>
              </div>
            );

            return lesson ? (
              <Link key={assignment.id} href={`/lessons/${lesson.id}`} className="card card-hover block">
                {content}
              </Link>
            ) : (
              <div key={assignment.id} className="card">
                {content}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
