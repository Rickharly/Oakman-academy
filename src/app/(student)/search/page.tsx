import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { subjectTheme } from "@/components/student/subjectTheme";
import { cn } from "@/lib/cn";

type LessonMatch = {
  id: string;
  title: string;
  unit: { title: string; programme: { subject: { id: string; title: string; slug: string } } };
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const user = await requireStudent();
  const studentId = user.studentProfile.id;

  let matches: LessonMatch[] = [];
  if (query.length > 0) {
    const enrolments = await prisma.studentEnrolment.findMany({
      where: { studentId, active: true },
      select: { programmeId: true },
    });
    const programmeIds = enrolments.map((e) => e.programmeId);

    if (programmeIds.length > 0) {
      const lessons = await prisma.lesson.findMany({
        where: { unit: { programmeId: { in: programmeIds } } },
        include: { unit: { include: { programme: { include: { subject: true } } } } },
        orderBy: [{ unit: { order: "asc" } }, { order: "asc" }],
      });

      const needle = query.toLowerCase();
      matches = lessons.filter((l) => {
        if (l.title.toLowerCase().includes(needle)) return true;
        if (l.unit.title.toLowerCase().includes(needle)) return true;
        const keywords = (l.keywords as { keyword: string; description: string }[] | null) ?? [];
        return keywords.some(
          (k) => k.keyword.toLowerCase().includes(needle) || k.description.toLowerCase().includes(needle)
        );
      });
    }
  }

  const bySubject = new Map<string, { title: string; slug: string; lessons: LessonMatch[] }>();
  for (const l of matches) {
    const subject = l.unit.programme.subject;
    if (!bySubject.has(subject.id)) bySubject.set(subject.id, { title: subject.title, slug: subject.slug, lessons: [] });
    bySubject.get(subject.id)!.lessons.push(l);
  }

  return (
    <>
      <PageHeader title="Search" />

      <form action="/search" className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search lessons"
          aria-label="Search lessons"
          autoFocus
          className="h-12 w-full rounded-xl border border-line bg-surface-raised pl-10 pr-4 text-base text-ink placeholder:text-ink-faint outline-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </form>

      {query.length === 0 ? (
        <EmptyState icon={SearchIcon} title="Search your lessons" description="Type a topic, keyword or lesson title above." />
      ) : bySubject.size === 0 ? (
        <EmptyState icon={SearchIcon} title="No lessons found" description={`Nothing matched "${query}".`} />
      ) : (
        <div className="space-y-8">
          {[...bySubject.values()].map((group) => {
            const theme = subjectTheme(group.slug);
            return (
              <div key={group.slug} className="space-y-3">
                <p className={cn("text-xs font-semibold uppercase tracking-wide", theme.text)}>{group.title}</p>
                <div className="space-y-2">
                  {group.lessons.map((l) => (
                    <Link key={l.id} href={`/lessons/${l.id}`} className="card card-hover block p-4">
                      <p className="font-medium text-ink">{l.title}</p>
                      <p className="text-sm text-ink-muted">{l.unit.title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
