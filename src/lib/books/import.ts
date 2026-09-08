/**
 * Importing a book into the library.
 *
 * The text is fetched once, split, and stored as `ReadingText` chapters so a chapter behaves
 * exactly like any other passage. Prompts are *not* generated here: writing three questions for
 * every chapter of a 34-chapter novel at import time is a lot of model calls for chapters that
 * may never be read, so they are written lazily the first time a chapter is served.
 *
 * Re-importing the same book replaces its chapters but never its `ReadingEntry` rows — a
 * child's writing survives a re-import, because learning history is never overwritten.
 */
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { Book } from "@/generated/prisma/client";
import {
  estimateMinutes,
  gutenbergTextUrls,
  splitIntoChapters,
  stripGutenbergWrapper,
  type SplitOptions,
} from "./gutenberg";

export const bookCandidateSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  authorDeathYear: z.number().int().nullable(),
  publicDomainInUkAndCanada: z.boolean().optional(),
  gutenbergId: z.number().int().nullable(),
  gutenbergUrl: z.string().optional(),
  yearGroup: z.number().int().min(1).max(13),
  difficulty: z.enum(["accessible", "stretching", "hard"]).default("stretching"),
  whyThisBook: z.string().optional(),
  contentNotes: z.string().optional(),
});

export type BookCandidate = z.infer<typeof bookCandidateSchema>;

/**
 * The UK and Canada both run to life of the author + 70 years, which is a stricter test than
 * the US rule Project Gutenberg applies. A book that fails this is not imported, whatever
 * Gutenberg says about it.
 */
export function isPublicDomainHere(authorDeathYear: number | null, now = new Date()): boolean {
  if (authorDeathYear == null) return false;
  return authorDeathYear + 70 < now.getUTCFullYear();
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function fetchFirst(urls: string[]): Promise<{ text: string; url: string }> {
  const failures: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Oakman Academy (home education, private use)" },
      });
      if (!res.ok) {
        failures.push(`${url} → HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      // A Gutenberg error page is a valid 200. A real book is not three kilobytes.
      if (text.length < 20_000) {
        failures.push(`${url} → only ${text.length} bytes, that is not a book`);
        continue;
      }
      return { text, url };
    } catch (err) {
      failures.push(`${url} → ${err instanceof Error ? err.message : "request failed"}`);
    }
  }
  throw new Error(`Could not download the text.\n  ${failures.join("\n  ")}`);
}

export type ImportResult = {
  book: Book;
  chapters: number;
  words: number;
};

/**
 * Imports one book. `loadText` is injectable so the whole pipeline can be exercised without a
 * network — the download is the one part that cannot be tested everywhere, so it is kept to a
 * single seam rather than spread through the function.
 */
export async function importBook(
  candidate: BookCandidate,
  opts: { split?: SplitOptions; loadText?: (c: BookCandidate) => Promise<{ text: string; url: string }> } = {},
): Promise<ImportResult> {
  const parsed = bookCandidateSchema.parse(candidate);

  if (!isPublicDomainHere(parsed.authorDeathYear)) {
    throw new Error(
      `${parsed.title}: author death year ${parsed.authorDeathYear ?? "unknown"} does not clear ` +
        "life + 70 in the UK and Canada. Not importing.",
    );
  }
  if (parsed.gutenbergId == null && !opts.loadText) {
    throw new Error(`${parsed.title}: no Project Gutenberg id, and no other source given.`);
  }

  const load = opts.loadText ?? ((c: BookCandidate) => fetchFirst(gutenbergTextUrls(c.gutenbergId!)));
  const { text, url } = await load(parsed);

  const chapters = splitIntoChapters(stripGutenbergWrapper(text), opts.split);
  const words = chapters.reduce((n, c) => n + c.wordCount, 0);
  const slug = slugify(parsed.title);

  const book = await prisma.book.upsert({
    where: { slug },
    create: {
      slug,
      title: parsed.title,
      author: parsed.author,
      authorDeathYear: parsed.authorDeathYear,
      source: "gutenberg",
      sourceRef: parsed.gutenbergId == null ? null : String(parsed.gutenbergId),
      sourceUrl: url,
      yearGroup: parsed.yearGroup,
      difficulty: parsed.difficulty,
      contentNotes: parsed.contentNotes ?? null,
      whyThisBook: parsed.whyThisBook ?? null,
      chapterCount: chapters.length,
      wordCount: words,
      importedAt: new Date(),
    },
    update: {
      title: parsed.title,
      author: parsed.author,
      authorDeathYear: parsed.authorDeathYear,
      sourceUrl: url,
      yearGroup: parsed.yearGroup,
      difficulty: parsed.difficulty,
      contentNotes: parsed.contentNotes ?? null,
      whyThisBook: parsed.whyThisBook ?? null,
      chapterCount: chapters.length,
      wordCount: words,
      importedAt: new Date(),
    },
  });

  // Chapters are replaced on re-import, but only those nobody has written about: a child's
  // response is learning history and outlives any change to the text it was about.
  const existing = await prisma.readingText.findMany({
    where: { bookId: book.id },
    select: { id: true, chapterNumber: true, _count: { select: { entries: true } } },
  });
  const untouched = existing.filter((c) => c._count.entries === 0).map((c) => c.id);
  if (untouched.length) {
    await prisma.readingText.deleteMany({ where: { id: { in: untouched } } });
  }

  for (const chapter of chapters) {
    const chapterSlug = `${slug}-ch${String(chapter.number).padStart(3, "0")}`;
    const data = {
      title: chapter.title,
      author: parsed.author,
      yearGroup: parsed.yearGroup,
      order: chapter.number,
      genre: "fiction",
      body: chapter.body,
      wordCount: chapter.wordCount,
      estimatedMinutes: estimateMinutes(chapter.wordCount),
      bookId: book.id,
      chapterNumber: chapter.number,
    };
    await prisma.readingText.upsert({
      where: { slug: chapterSlug },
      create: { slug: chapterSlug, ...data },
      // Prompts already written for this chapter are kept.
      update: data,
    });
  }

  return { book, chapters: chapters.length, words };
}

/** Makes one book the current class novel for its year group, and stands the others down. */
export async function setActiveBook(bookId: string): Promise<Book> {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  await prisma.book.updateMany({
    where: { yearGroup: book.yearGroup, id: { not: bookId } },
    data: { active: false },
  });
  return prisma.book.update({ where: { id: bookId }, data: { active: true } });
}

export async function deactivateBook(bookId: string): Promise<Book> {
  return prisma.book.update({ where: { id: bookId }, data: { active: false } });
}
