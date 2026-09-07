import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { requireParent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getStudentOverview } from "@/lib/progress/aggregate";

export default async function AdminStudentsPage() {
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
        <PageHeader title="Students" />
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Add a student account from Settings to get started."
          action={<Button href="/admin/settings">Go to settings</Button>}
        />
      </>
    );
  }

  const overviews = await Promise.all(students.map((s) => getStudentOverview(s.studentProfile!.id)));

  return (
    <>
      <PageHeader title="Students" description="Everyone learning in this family." actions={<Button href="/admin/settings">Add a student</Button>} />
      <div className="grid gap-4 sm:grid-cols-2">
        {students.map((s, i) => {
          const profile = s.studentProfile!;
          const overview = overviews[i];
          return (
            <Card key={s.id} padding="lg" className="space-y-5">
              <div className="flex items-center gap-3">
                <Avatar emoji={s.avatar ?? "🙂"} size="lg" />
                <div>
                  <p className="text-lg font-semibold text-ink">{s.displayName}</p>
                  <p className="text-sm text-ink-muted">
                    Year {profile.yearGroup} · {profile.keyStage.toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Today" value={`${overview.today.done} / ${overview.today.total}`} />
                <Stat label="This week" value={`${overview.week.pct}%`} />
                <Stat
                  label="Avg mastery"
                  value={overview.averageMastery != null ? `${Math.round(overview.averageMastery * 100)}%` : "—"}
                />
                <Stat label="Needs review" value={overview.needsReview} />
              </div>
              <div className="flex items-center gap-2">
                <Button href={`/admin/students/${profile.id}`}>View</Button>
                <Button variant="secondary" href="/admin/settings">
                  Reset PIN
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
