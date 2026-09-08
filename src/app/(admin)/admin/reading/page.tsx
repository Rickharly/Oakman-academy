import fs from "node:fs";
import path from "node:path";
import { BookOpen, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireParent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { bookCandidateSchema, isPublicDomainHere, slugify } from "@/lib/books/import";
import { BookActions, ImportBookButton } from "@/components/admin/BookActions";
import { z } from "zod";

export const dynamic = "force-dynamic";

function loadCandidates() {
  const file = path.resolve(process.cwd(), "fixtures/books/candidates.json");
  if (!fs.existsSync(file)) return [];
  try {
    return z.array(bookCandidateSchema).parse(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return [];
  }
}

/**
 * The reading library: which book each child is on, and what else is available.
 *
 * Content notes are shown next to the "set as class novel" button rather than buried, because
 * the decision to hand a child a hundred-year-old book is one a parent should make with the
 * warning in front of them.
 */
export default async function AdminReadingPage() {
  await requireParent();

  const [books, students, candidates] = await Promise.all([
    prisma.book.findMany({ orderBy: [{ yearGroup: "asc" }, { title: "asc" }] }),
    prisma.studentProfile.findMany({ include: { user: true }, orderBy: { yearGroup: "asc" } }),
    Promise.resolve(loadCandidates()),
  ]);

  const importedSlugs = new Set(books.map((b) => b.slug));
  const notImported = candidates.filter((c) => !importedSlugs.has(slugify(c.title)));

  const progress = await Promise.all(
    students.map(async (student) => {
      const active = books.find((b) => b.yearGroup === student.yearGroup && b.active);
      if (!active) return { student, active: null, read: 0 };
      const read = await prisma.readingEntry.findMany({
        where: { studentId: student.id, readingText: { bookId: active.id } },
        select: { readingTextId: true },
        distinct: ["readingTextId"],
      });
      return { student, active, read: read.length };
    }),
  );

  return (
    <>
      <PageHeader
        title="Reading"
        description="The class novel each child is working through, and the library it comes from."
      />

      <Card padding="lg" className="mb-6 space-y-4">
        <h2 className="text-base font-semibold text-ink">Currently reading</h2>
        {progress.map(({ student, active, read }) => (
          <div key={student.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-ink">
                {student.user.displayName}{" "}
                <span className="text-ink-muted">· Year {student.yearGroup}</span>
              </p>
              {active ? (
                <p className="text-sm text-ink-muted">
                  {active.title} — {read} of {active.chapterCount} chapters
                </p>
              ) : (
                <p className="text-sm text-ink-muted">
                  No book set. They are reading the short passages instead.
                </p>
              )}
            </div>
            {active ? <Badge tone="neutral">{active.difficulty}</Badge> : null}
          </div>
        ))}
      </Card>

      <Card padding="lg" className="mb-6 space-y-4">
        <h2 className="text-base font-semibold text-ink">In the library</h2>
        {books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No books imported yet"
            description="Import one from the list below, or run pnpm books:import where the app is deployed."
          />
        ) : (
          <ul className="divide-y divide-line">
            {books.map((book) => (
              <li key={book.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {book.title} <span className="text-ink-muted">· {book.author}</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      Year {book.yearGroup} · {book.difficulty} · {book.chapterCount} chapters ·{" "}
                      {book.wordCount.toLocaleString()} words
                      {book.authorDeathYear ? ` · author d. ${book.authorDeathYear}` : ""}
                    </p>
                  </div>
                  <BookActions bookId={book.id} active={book.active} />
                </div>
                {book.whyThisBook ? <p className="text-sm text-ink-muted">{book.whyThisBook}</p> : null}
                {book.contentNotes && !/^nothing of concern\.?$/i.test(book.contentNotes) ? (
                  <p className="flex gap-1.5 rounded-2xl bg-warning-soft p-3 text-sm text-ink">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>{book.contentNotes}</span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {notImported.length > 0 ? (
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Available to import</h2>
            <p className="text-sm text-ink-muted">
              Public domain in the UK and Canada (author died more than 70 years ago), downloaded
              from Project Gutenberg. Importing needs internet access from the server.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {notImported.map((c) => (
              <li key={c.title} className="space-y-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {c.title} <span className="text-ink-muted">· {c.author}</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      Year {c.yearGroup} · {c.difficulty}
                      {c.authorDeathYear ? ` · author d. ${c.authorDeathYear}` : ""}
                      {isPublicDomainHere(c.authorDeathYear) ? "" : " · NOT public domain here"}
                    </p>
                  </div>
                  <ImportBookButton title={c.title} />
                </div>
                {c.whyThisBook ? <p className="text-sm text-ink-muted">{c.whyThisBook}</p> : null}
                {c.contentNotes && !/^nothing of concern\.?$/i.test(c.contentNotes) ? (
                  <p className="flex gap-1.5 rounded-2xl bg-warning-soft p-3 text-sm text-ink">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>{c.contentNotes}</span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
