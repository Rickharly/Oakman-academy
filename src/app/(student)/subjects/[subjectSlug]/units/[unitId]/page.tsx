import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Circle, CheckCircle2, RotateCcw, Star } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { lessonStatusToBadge, formatMinutes } from "@/components/student/format";

const STATUS_ICON = {
  NOT_STARTED: Circle,
  IN_PROGRESS: Circle,
  COMPLETED: CheckCircle2,
  NEEDS_REVIEW: RotateCcw,
  MASTERED: Star,
  ALREADY_KNOWN: CheckCircle2,
} as const;

export default async function UnitPage({
  params,
}: {
  params: Promise<{ subjectSlug: string; unitId: string }>;
}) {
  const { subjectSlug, unitId } = await params;
  const user = await requireStudent();
  const studentId = user.studentProfile.id;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      programme: { include: { subject: true } },
      lessons: { orderBy: { order: "asc" } },
    },
  });
  if (!unit || unit.programme.subject.slug !== subjectSlug) notFound();

  const enrolment = await prisma.studentEnrolment.findFirst({
    where: { studentId, active: true, programmeId: unit.programmeId },
  });
  if (!enrolment) notFound();

  const progressRows = await prisma.studentLessonProgress.findMany({
    where: { studentId, lessonId: { in: unit.lessons.map((l) => l.id) } },
  });
  const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));

  return (
    <>
      <PageHeader title={unit.title} description={unit.programme.subject.title} />

      {unit.lessons.length === 0 ? (
        <EmptyState title="No lessons yet" description="This unit doesn't have any lessons imported yet." />
      ) : (
        <div className="space-y-3">
          {unit.lessons.map((lesson) => {
            const progress = progressByLesson.get(lesson.id);
            const status = progress?.status ?? "NOT_STARTED";
            const Icon = STATUS_ICON[status];
            return (
              <Link
                key={lesson.id}
                href={`/lessons/${lesson.id}`}
                className="card card-hover flex items-center gap-4 p-5"
              >
                <Icon
                  className={
                    status === "COMPLETED" || status === "MASTERED"
                      ? "h-5 w-5 shrink-0 text-success"
                      : status === "NEEDS_REVIEW"
                        ? "h-5 w-5 shrink-0 text-warning"
                        : "h-5 w-5 shrink-0 text-ink-faint"
                  }
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-ink">{lesson.title}</p>
                  <p className="text-xs text-ink-muted">{formatMinutes(lesson.estimatedMinutes)}</p>
                </div>
                <Badge status={lessonStatusToBadge(status)} />
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
