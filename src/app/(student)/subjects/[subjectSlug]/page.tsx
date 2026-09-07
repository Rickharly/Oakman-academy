import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getUnitProgress } from "@/lib/progress/aggregate";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { subjectTheme } from "@/components/student/subjectTheme";

export default async function SubjectPage({ params }: { params: Promise<{ subjectSlug: string }> }) {
  const { subjectSlug } = await params;
  const user = await requireStudent();
  const studentId = user.studentProfile.id;

  const subject = await prisma.subject.findFirst({ where: { slug: subjectSlug } });
  if (!subject) notFound();

  const enrolment = await prisma.studentEnrolment.findFirst({
    where: { studentId, active: true, programme: { subjectId: subject.id } },
    include: { programme: true },
  });
  if (!enrolment) notFound();

  const units = await getUnitProgress(studentId, enrolment.programmeId);
  const theme = subjectTheme(subject.slug);

  return (
    <>
      <PageHeader title={subject.title} description={enrolment.programme.title} />

      {units.length === 0 ? (
        <EmptyState title="No units yet" description="This subject doesn't have any units imported yet." />
      ) : (
        <div className="space-y-3">
          {units.map(({ unit, lessonsDone, lessonsTotal, mastery }) => {
            const pct = lessonsTotal > 0 ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;
            return (
              <Link
                key={unit.id}
                href={`/subjects/${subjectSlug}/units/${unit.id}`}
                className="card card-hover flex items-center gap-4 p-5"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-medium text-ink">{unit.title}</p>
                  <div className="flex items-center gap-3">
                    <ProgressBar size="sm" value={pct} barClassName={theme.stroke.replace("stroke-", "bg-")} className="max-w-xs" />
                    <span className="shrink-0 text-xs text-ink-muted">
                      {lessonsDone} / {lessonsTotal}
                    </span>
                  </div>
                  {mastery != null ? (
                    <p className="text-xs text-ink-faint">Mastery {Math.round(mastery * 100)}%</p>
                  ) : null}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
