import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { getSubjectProgress } from "@/lib/progress/aggregate";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { subjectTheme } from "@/components/student/subjectTheme";
import { SubjectGlyph } from "@/components/student/SubjectArt";

export default async function SubjectsPage() {
  const user = await requireStudent();
  const subjects = await getSubjectProgress(user.studentProfile.id);

  return (
    <>
      <PageHeader
        title="Subjects"
        actions={
          <form action="/search" className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              name="q"
              placeholder="Search lessons"
              aria-label="Search lessons"
              className="h-11 w-56 rounded-xl border border-line bg-surface-raised pl-10 pr-4 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </form>
        }
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description="Once you're enrolled in a subject, it will show up here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const theme = subjectTheme(s.subject.slug);
            const masteryPct = s.mastery != null ? Math.round(s.mastery * 100) : null;
            return (
              <Link
                key={s.subject.id}
                href={`/subjects/${s.subject.slug}`}
                className="card card-hover flex items-start justify-between gap-4 overflow-hidden p-6"
              >
                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-16 shrink-0 items-center justify-center rounded-xl ${theme.soft}`}>
                      <SubjectGlyph subjectSlug={s.subject.slug} className="h-7 w-14" />
                    </span>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${theme.text}`}>
                      {s.subject.title}
                    </span>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-ink">{s.completionPct}%</p>
                    <p className="text-sm text-ink-muted">
                      {s.lessonsDone} / {s.lessonsTotal} lessons
                    </p>
                  </div>
                </div>
                <ProgressRing
                  value={masteryPct ?? 0}
                  size={56}
                  progressClassName={theme.stroke}
                  label={<span className="text-xs font-semibold text-ink">{masteryPct ?? "–"}</span>}
                />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
