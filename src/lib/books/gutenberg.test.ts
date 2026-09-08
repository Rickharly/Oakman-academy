import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  estimateMinutes,
  gutenbergTextUrls,
  splitIntoChapters,
  stripGutenbergWrapper,
} from "./gutenberg";

const SAMPLE = fs.readFileSync(
  path.resolve(__dirname, "../../../tests/fixtures/gutenberg-sample.txt"),
  "utf8",
);

describe("stripping the Gutenberg wrapper", () => {
  const stripped = stripGutenbergWrapper(SAMPLE);

  it("removes the header so the licence never becomes chapter one", () => {
    expect(stripped).not.toContain("This eBook is for the use of anyone anywhere");
    expect(stripped).not.toContain("Title: The Grey Shore");
  });

  it("removes the licence footer", () => {
    expect(stripped).not.toContain("FULL PROJECT GUTENBERG LICENSE");
    expect(stripped).not.toContain("Updated editions will replace");
  });

  it("removes the produced-by line", () => {
    expect(stripped).not.toContain("Produced by Some Volunteer");
  });

  it("keeps the book itself", () => {
    expect(stripped).toContain("The Old Sea-dog");
    expect(stripped).toContain("The sea was grey that morning");
  });

  it("copes with a file that has no markers at all", () => {
    expect(stripGutenbergWrapper("Just some text.\r\n\r\nAnd more.")).toBe(
      "Just some text.\n\nAnd more.",
    );
  });
});

describe("splitting into chapters", () => {
  const chapters = splitIntoChapters(stripGutenbergWrapper(SAMPLE));

  it("finds every chapter that has text under it", () => {
    // I, II, III (split into parts), IV and VI. V has no body and must not appear.
    expect(chapters.length).toBeGreaterThanOrEqual(5);
    expect(chapters.some((c) => c.title.includes("Nothing Here"))).toBe(false);
  });

  it("keeps the chapter titles, not just the numbers", () => {
    expect(chapters[0].title).toContain("The Old Sea-dog");
    expect(chapters[1].title).toContain("Black Dog Appears");
  });

  it("numbers them in reading order with no gaps", () => {
    expect(chapters.map((c) => c.number)).toEqual(chapters.map((_, i) => i + 1));
  });

  it("breaks a very long chapter into sittings rather than serving a wall of text", () => {
    const parts = chapters.filter((c) => c.title.includes("The Long Watch"));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].title).toMatch(/part 1 of \d+/);
    // No sitting is longer than the cap.
    expect(chapters.every((c) => c.wordCount <= 3500)).toBe(true);
  });

  it("drops front matter and contents pages", () => {
    expect(chapters.some((c) => c.body.includes("CONTENTS"))).toBe(false);
  });

  it("never emits an empty chapter", () => {
    expect(chapters.every((c) => c.body.trim().length > 0 && c.wordCount > 0)).toBe(true);
  });

  it("does not split on the word 'chapter' inside a sentence", () => {
    const prose =
      "CHAPTER I. The Start\n\n" +
      "She read the chapter again. In Chapter 4 of the book he had said the same thing, and " +
      "the whole chapter turned on it. ".repeat(30);
    expect(splitIntoChapters(prose, { minWords: 20 })).toHaveLength(1);
  });

  it("throws rather than guessing when it cannot find chapters", () => {
    expect(() => splitIntoChapters("Just a page of prose with no headings at all.")).toThrow(
      /No chapters found/,
    );
  });

  it("respects a caller's own limits", () => {
    const chunky = splitIntoChapters(stripGutenbergWrapper(SAMPLE), { maxWords: 400 });
    expect(chunky.every((c) => c.wordCount <= 400)).toBe(true);
    expect(chunky.length).toBeGreaterThan(chapters.length);
  });
});

describe("reading time", () => {
  it("estimates from length and never says less than five minutes", () => {
    expect(estimateMinutes(1800)).toBe(10);
    expect(estimateMinutes(50)).toBe(5);
  });
});

describe("where the text is fetched from", () => {
  it("offers the known Gutenberg locations in order", () => {
    const urls = gutenbergTextUrls(120);
    expect(urls[0]).toBe("https://www.gutenberg.org/cache/epub/120/pg120.txt");
    expect(urls).toHaveLength(3);
    expect(urls.every((u) => u.startsWith("https://"))).toBe(true);
  });
});
