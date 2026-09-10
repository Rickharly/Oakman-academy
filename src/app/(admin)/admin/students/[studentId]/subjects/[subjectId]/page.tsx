import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireParentOfStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getUnitProgress } from "@/lib/progress/aggregate";

const STATUS_BADGE: Record<string, BadgeStatus> = {
  NOT_STARTED: "not-started",
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
  NEEDS_REVIEW: "needs-review",
  MASTERED: "mastered",
  ALREADY_KNOWN: "already-known",
};

export default async function AdminSubjectPage({
  params,
}: {
  params: Promise<{ studentId: string; subjectId: string }>;
}) {
  const { studentId, subjectId } = await params;
  const { student } = await requireParentOfStudent(studentId);

  const enrolment = await prisma.studentEnrolment.findFirst({
    where: { studentId, programme: { subjectId } },
    include: { programme: { include: { subject: true } } },
  });
  if (!enrolment) notFound();

  const units = await getUnitProgress(studentId, enrolment.programmeId);

  return (
    <>
      <PageHeader
        title={enrolment.programme.subject.title}
        description={`${student.user.displayName} · ${enrolment.programme.title}`}
      />

      {units.length === 0 ? (
        <EmptyState title="No units yet" description="This programme has no synced units yet." />
      ) : (
        <div className="space-y-8">
          {units.map((u) => (
            <Card key={u.unit.id} padding="lg" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink">{u.unit.title}</h2>
                  <p className="text-sm text-ink-muted">
                    {u.lessonsDone} / {u.lessonsTotal} lessons complete
                    {u.mastery != null ? ` · ${Math.round(u.mastery * 100)}% mastery` : ""}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                      <th className="pb-2 font-medium">Lesson</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Best score</th>
                      <th className="pb-2 text-right font-medium">Mastery</th>
                      <th className="pb-2 text-right font-medium">Attempts</th>
                      <th className="pb-2 text-right font-medium">Last activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {u.lessons.map((lesson) => {
                      const progress = lesson.progress;
                      const lowScore = progress?.bestScorePct != null && progress.bestScorePct < 70;
                      return (
                        <tr key={lesson.id}>
                          <td className="py-3 pr-4">
                            <Link
                              href={`/admin/students/${studentId}/lessons/${lesson.id}`}
                              className="font-medium text-ink hover:text-accent hover:underline"
                            >
                              {lesson.title}
                            </Link>
                          </td>
                          <td className="py-3">
                            <Badge status={STATUS_BADGE[progress?.status ?? "NOT_STARTED"]} />
                          </td>
                          <td className="py-3 text-right tabular-nums">
                            <span className={lowScore ? "inline-flex items-center gap-1 text-warning" : "text-ink"}>
                              {lowScore ? <TriangleAlert className="h-3.5 w-3.5" /> : null}
                              {progress?.bestScorePct != null ? `${Math.round(progress.bestScorePct)}%` : "—"}
                            </span>
                          </td>
                          <td className="py-3 text-right tabular-nums text-ink">
                            {progress?.mastery != null ? `${Math.round(progress.mastery * 100)}%` : "—"}
                          </td>
                          <td className="py-3 text-right tabular-nums text-ink-muted">{progress?.attempts ?? 0}</td>
                          <td className="py-3 text-right text-xs text-ink-muted">
                            {progress?.lastActivityAt ? progress.lastActivityAt.toLocaleDateString("en-GB") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
