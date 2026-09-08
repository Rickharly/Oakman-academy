import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { deactivateBook, importBook, isPublicDomainHere, setActiveBook } from "@/lib/books/import";
import { getNextReadingText, submitReadingResponse } from "@/lib/reading/service";
import { seedReadingLibrary } from "@/lib/reading/library";
import { bookCandidateSchema } from "@/lib/books/import";
import { z } from "zod";

const SAMPLE = fs.readFileSync(path.resolve(__dirname, "fixtures/gutenberg-sample.txt"), "utf8");

/** Stands in for the download, so the whole pipeline runs without a network. */
const loadText = async () => ({ text: SAMPLE, url: "https://example.test/pg1.txt" });

const CANDIDATE = {
  title: "The Grey Shore",
  author: "A. N. Author",
  authorDeathYear: 1894,
  gutenbergId: 1,
  yearGroup: 5,
  difficulty: "stretching" as const,
  whyThisBook: "A short sea adventure.",
  contentNotes: "Nothing of concern.",
};

async function makeStudent(yearGroup: number, username = "reader") {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username, passwordHash: "x", displayName: "Reader" },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup, keyStage: yearGroup > 6 ? "ks3" : "ks2" },
  });
  return profile.id;
}

beforeEach(async () => {
  await resetDb();
});

describe("copyright, which is checked before anything is downloaded", () => {
  it("uses life + 70, not Project Gutenberg's US test", () => {
    // Public domain in the US, still in copyright in the UK and Canada in 2026.
    expect(isPublicDomainHere(1960, new Date("2026-01-01"))).toBe(false);
    expect(isPublicDomainHere(1955, new Date("2026-01-01"))).toBe(true);
    expect(isPublicDomainHere(null)).toBe(false);
  });

  it("refuses to import a book that fails it, network or no network", async () => {
    await expect(
      importBook({ ...CANDIDATE, authorDeathYear: 1990 }, { loadText }),
    ).rejects.toThrow(/life \+ 70/);
    expect(await prisma.book.count()).toBe(0);
  });

  it("refuses a book with no source at all", async () => {
    await expect(importBook({ ...CANDIDATE, gutenbergId: null })).rejects.toThrow(/no Project Gutenberg id/);
  });
});

describe("the shipped candidate list", () => {
  it("parses, and every entry clears life + 70 with a real Gutenberg id", () => {
    const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/books/candidates.json"), "utf8"));
    const books = z.array(bookCandidateSchema).parse(raw);

    expect(books.length).toBeGreaterThanOrEqual(16);
    expect(books.every((b) => isPublicDomainHere(b.authorDeathYear))).toBe(true);
    expect(books.every((b) => b.gutenbergId != null)).toBe(true);
    // Both children are covered.
    expect(books.some((b) => b.yearGroup === 5)).toBe(true);
    expect(books.some((b) => b.yearGroup === 7)).toBe(true);
  });
});

describe("importing a book", () => {
  it("stores the book and its chapters as readable passages", async () => {
    const result = await importBook(CANDIDATE, { loadText });

    expect(result.chapters).toBeGreaterThanOrEqual(5);
    expect(result.book.slug).toBe("the-grey-shore");
    expect(result.book.sourceRef).toBe("1");
    expect(result.book.chapterCount).toBe(result.chapters);

    const chapters = await prisma.readingText.findMany({
      where: { bookId: result.book.id },
      orderBy: { chapterNumber: "asc" },
    });
    expect(chapters).toHaveLength(result.chapters);
    expect(chapters[0].chapterNumber).toBe(1);
    expect(chapters[0].estimatedMinutes).toBeGreaterThanOrEqual(5);
    // The licence never becomes a chapter.
    expect(chapters.every((c) => !c.body.includes("PROJECT GUTENBERG LICENSE"))).toBe(true);
    expect(chapters.every((c) => c.body.trim().length > 0)).toBe(true);
  });

  it("is idempotent — importing twice does not double the chapters", async () => {
    const first = await importBook(CANDIDATE, { loadText });
    const second = await importBook(CANDIDATE, { loadText });

    expect(second.book.id).toBe(first.book.id);
    expect(await prisma.readingText.count({ where: { bookId: first.book.id } })).toBe(first.chapters);
    expect(await prisma.book.count()).toBe(1);
  });

  it("never destroys a chapter a child has written about", async () => {
    const { book } = await importBook(CANDIDATE, { loadText });
    const studentId = await makeStudent(5);
    const chapter = await prisma.readingText.findFirstOrThrow({
      where: { bookId: book.id },
      orderBy: { chapterNumber: "asc" },
    });
    await submitReadingResponse({
      studentId,
      readingTextId: chapter.id,
      promptIndex: 0,
      response: "The sea sounded cold and I liked the grass bending flat.",
    });

    // Re-import with different splitting, which would otherwise replace every chapter.
    await importBook(CANDIDATE, { loadText, split: { maxWords: 400 } });

    const stillThere = await prisma.readingText.findUnique({ where: { id: chapter.id } });
    expect(stillThere).not.toBeNull();
    const entries = await prisma.readingEntry.count({ where: { studentId } });
    expect(entries).toBe(1);
  });
});

describe("the class novel", () => {
  it("serves the next chapter in order once a book is set", async () => {
    const { book } = await importBook(CANDIDATE, { loadText });
    await setActiveBook(book.id);
    const studentId = await makeStudent(5);

    const first = await getNextReadingText(studentId);
    expect(first!.bookId).toBe(book.id);
    expect(first!.chapterNumber).toBe(1);

    await submitReadingResponse({
      studentId,
      readingTextId: first!.id,
      promptIndex: 0,
      response: "A boy finds a bike behind a shed and the sea is grey.",
    });

    const second = await getNextReadingText(studentId);
    expect(second!.chapterNumber).toBe(2);
  });

  it("writes the chapter's questions the first time it is opened, then keeps them", async () => {
    const { book } = await importBook(CANDIDATE, { loadText });
    await setActiveBook(book.id);
    const studentId = await makeStudent(5);

    const chapter = await getNextReadingText(studentId);
    const prompts = chapter!.prompts as string[];
    expect(prompts.length).toBeGreaterThanOrEqual(2);

    // Persisted, so tomorrow they see the same questions.
    const stored = await prisma.readingText.findUniqueOrThrow({ where: { id: chapter!.id } });
    expect(stored.prompts).toEqual(chapter!.prompts);

    const again = await getNextReadingText(studentId);
    expect(again!.prompts).toEqual(chapter!.prompts);
  });

  it("only one book at a time is the class novel for a year group", async () => {
    const a = await importBook(CANDIDATE, { loadText });
    const b = await importBook({ ...CANDIDATE, title: "The Second Shore" }, { loadText });

    await setActiveBook(a.book.id);
    await setActiveBook(b.book.id);

    const active = await prisma.book.findMany({ where: { yearGroup: 5, active: true } });
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(b.book.id);
  });

  it("falls back to the standalone passages when no book is set", async () => {
    await seedReadingLibrary();
    const { book } = await importBook(CANDIDATE, { loadText });
    await setActiveBook(book.id);
    const studentId = await makeStudent(5);

    expect((await getNextReadingText(studentId))!.bookId).toBe(book.id);

    await deactivateBook(book.id);
    const next = await getNextReadingText(studentId);
    expect(next!.bookId).toBeNull();
  });

  it("moves on to the passages once the book is finished rather than stopping", async () => {
    await seedReadingLibrary();
    const { book } = await importBook(CANDIDATE, { loadText });
    await setActiveBook(book.id);
    const studentId = await makeStudent(5);

    // Read the whole book.
    const chapters = await prisma.readingText.findMany({ where: { bookId: book.id } });
    for (const chapter of chapters) {
      await submitReadingResponse({
        studentId,
        readingTextId: chapter.id,
        promptIndex: 0,
        response: "I read this chapter and thought about the grey sea and the wind.",
      });
    }

    const next = await getNextReadingText(studentId);
    expect(next).not.toBeNull();
    expect(next!.bookId).toBeNull();
  });

  it("does not give a Year 7 book to a Year 5 child", async () => {
    const { book } = await importBook({ ...CANDIDATE, yearGroup: 7 }, { loadText });
    await setActiveBook(book.id);
    const younger = await makeStudent(5, "younger");

    const next = await getNextReadingText(younger);
    expect(next?.bookId ?? null).toBeNull();
  });
});
