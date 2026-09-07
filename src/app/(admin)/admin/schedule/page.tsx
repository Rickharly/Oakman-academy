import Link from "next/link";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { requireParent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ScheduleEditor } from "@/components/admin/ScheduleEditor";
import { addDaysKey, schoolDayKey, weekStartKey } from "@/lib/dates";

export default async function AdminSchedulePage({
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
        <PageHeader title="Schedule" />
        <EmptyState icon={Calendar} title="No students yet" description="Add a student account from Settings first." />
      </>
    );
  }

  const selected = students.find((s) => s.studentProfile!.id === selectedParam) ?? students[0];
  const studentId = selected.studentProfile!.id;

  const [subjects, rules, mondayKey] = await Promise.all([
    prisma.subject.findMany({ orderBy: { title: "asc" } }),
    prisma.studentSchedule.findMany({ where: { studentId, active: true } }),
    Promise.resolve(weekStartKey(schoolDayKey())),
  ]);
  const weekKeys = [0, 1, 2, 3, 4].map((i) => addDaysKey(mondayKey, i));
  const weekDates = weekKeys.map((k) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  });

  const assignments = await prisma.dailyAssignment.findMany({
    where: { studentId, date: { in: weekDates } },
    orderBy: [{ date: "asc" }, { order: "asc" }],
    include: { lesson: true },
  });

  const lessons = await prisma.lesson.findMany({
    where: { unit: { programme: { enrolments: { some: { studentId, active: true } } } } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
    take: 500,
  });

  return (
    <>
      <PageHeader title="Schedule" description="Weekly frequencies, day preferences, and this week's plan." />

      {students.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/admin/schedule?student=${s.studentProfile!.id}`}
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

      <Card padding="none" className="mb-6 overflow-hidden">
        <ScheduleEditor
          studentId={studentId}
          subjects={subjects.map((s) => ({ id: s.id, title: s.title }))}
          initialRules={rules.map((r) => ({
            subjectId: r.subjectId,
            weeklyFrequency: r.weeklyFrequency,
            preferredDays: (r.preferredDays as number[]) ?? [],
          }))}
          weekKeys={weekKeys}
          assignments={assignments.map((a) => ({
            id: a.id,
            dateKey: a.date.toISOString().slice(0, 10),
            kind: a.kind,
            status: a.status,
            title: a.lesson?.title ?? a.customTitle ?? "Assignment",
            estimatedMinutes: a.estimatedMinutes,
            optional: a.optional,
            lessonId: a.lessonId,
          }))}
          lessons={lessons}
        />
      </Card>
    </>
  );
}
