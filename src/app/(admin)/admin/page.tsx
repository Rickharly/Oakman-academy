import Link from "next/link";
import { LayoutGrid, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { requireParent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getStudentOverview } from "@/lib/progress/aggregate";

const REASON_LABEL: Record<string, string> = {
  LOW_SCORE: "Low score",
  MISCONCEPTION: "Misconception",
  REPEATED_MISTAKE: "Repeated mistake",
  PARENT_ASSIGNED: "Assigned by you",
  SPACED: "Due for review",
};

export default async function AdminOverviewPage() {
  const parent = await requireParent();
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: parent.id },
    include: { student: { include: { studentProfile: true } } },
    orderBy: { createdAt: "asc" },
  });
  const students = links.map((l) => l.student).filter((u) => u.studentProfile != null);

  if (students.length === 0) {
    return (
      <>
        <PageHeader title="Overview" />
        <EmptyState
          icon={LayoutGrid}
          title="No students yet"
          description="Add a student account from Settings to get started."
          action={<Button href="/admin/settings">Go to settings</Button>}
        />
      </>
    );
  }

  const overviews = await Promise.all(students.map((s) => getStudentOverview(s.studentProfile!.id)));

  const attention = await prisma.reviewItem.findMany({
    where: {
      studentId: { in: students.map((s) => s.studentProfile!.id) },
      status: { in: ["PENDING", "SCHEDULED"] },
      reason: { in: ["LOW_SCORE", "MISCONCEPTION", "REPEATED_MISTAKE"] },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { lesson: true, student: { include: { user: true } } },
  });

  return (
    <>
      <PageHeader title="Overview" description="How everyone is doing." />

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {students.map((s, i) => {
          const profile = s.studentProfile!;
          const overview = overviews[i];
          return (
            <Card key={s.id} padding="lg" className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar emoji={s.avatar ?? "🙂"} size="lg" />
                  <div>
                    <p className="text-lg font-semibold text-ink">{s.displayName}</p>
                    <p className="text-sm text-ink-muted">Year {profile.yearGroup}</p>
                  </div>
                </div>
                <Button href={`/admin/students/${profile.id}`}>View</Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Today" value={`${overview.today.done} / ${overview.today.total} complete`} />
                <Stat label="This week" value={`${overview.week.pct}%`} />
                <Stat
                  label="Average mastery"
                  value={overview.averageMastery != null ? `${Math.round(overview.averageMastery * 100)}%` : "—"}
                />
                <Stat
                  label="Needs review"
                  value={overview.needsReview}
                  deltaTone={overview.needsReview > 0 ? "negative" : "neutral"}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <AlertTriangle className="h-4 w-4 text-warning" /> Needs your attention
        </h2>
        {attention.length === 0 ? (
          <EmptyState title="Nothing needs attention" description="No low scores, misconceptions, or repeated mistakes right now." />
        ) : (
          <Card padding="none" className="divide-y divide-line overflow-hidden">
            {attention.map((item) => (
              <Link
                key={item.id}
                href={`/admin/students/${item.studentId}/lessons/${item.lessonId}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-stone-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar emoji={item.student.user.avatar ?? "🙂"} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{item.lesson.title}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {item.student.user.displayName} · {item.detail ?? REASON_LABEL[item.reason]}
                    </p>
                  </div>
                </div>
                <Badge tone="warning">{REASON_LABEL[item.reason] ?? item.reason}</Badge>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
