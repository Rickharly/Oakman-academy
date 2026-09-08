/**
 * Turning a Project Gutenberg plain-text file into chapters a child can read in a sitting.
 *
 * Everything in this file is a pure function over a string, which is deliberate: the network
 * half of importing a book cannot be exercised from every environment, but the parsing half is
 * where the bugs actually live — a mis-detected chapter heading silently gives a child half a
 * chapter, or the licence text as their reading for the day.
 *
 * Gutenberg files are not a format so much as a convention, so this is written to fail loudly
 * (throw) rather than to guess: a book that does not split cleanly is one to look at by hand,
 * not one to hand to a nine-year-old.
 */

/** Both the modern and the older marker styles. */
const START_MARKERS = [
  /^\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*\*\*\*$/im,
  /^\*END\*THE SMALL PRINT.*$/im,
];
const END_MARKERS = [
  /^\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*\*\*\*$/im,
  /^End of (?:the )?Project Gutenberg('s)? EBook.*$/im,
];

/**
 * Strips the Gutenberg header and licence footer, leaving the work itself.
 *
 * The licence is not ours to redistribute inside the app, and more practically it is a
 * thousand words of legal text that would otherwise become chapter one.
 */
export function stripGutenbergWrapper(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");

  for (const marker of START_MARKERS) {
    const match = text.match(marker);
    if (match?.index != null) {
      text = text.slice(match.index + match[0].length);
      break;
    }
  }

  for (const marker of END_MARKERS) {
    const match = text.match(marker);
    if (match?.index != null) {
      text = text.slice(0, match.index);
      break;
    }
  }

  // Gutenberg often repeats a transcriber's note or a produced-by line before the text proper.
  text = text.replace(/^\s*Produced by .*$/im, "");

  return text.trim();
}

export type ParsedChapter = {
  number: number;
  title: string;
  body: string;
  wordCount: number;
};

/**
 * Chapter headings, most specific first.
 *
 * Order matters: "CHAPTER I. The Old Sea-dog" must win over a bare roman numeral, or the title
 * is lost. Anchored to a line of its own so the word "chapter" inside a sentence cannot split
 * the book.
 */
const HEADING_PATTERNS = [
  /^\s*(?:CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)\s*[.:—-]?\s*(.*)$/,
  /^\s*(?:PART|Part|BOOK|Book)\s+([IVXLCDM]+|\d+)\s*[.:—-]?\s*(.*)$/,
  /^\s*([IVXLCDM]{1,7})\s*\.\s*(.*)$/,
  /^\s*(\d{1,3})\s*\.\s+(\S.*)$/,
];

function headingFor(line: string): { label: string; title: string } | null {
  // A heading is short. A sentence that happens to start "Chapter" is not.
  if (line.trim().length === 0 || line.trim().length > 90) return null;
  for (const pattern of HEADING_PATTERNS) {
    const match = line.match(pattern);
    if (match) return { label: match[1], title: (match[2] ?? "").trim() };
  }
  return null;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Roughly 180 words a minute for a child reading carefully, floored at five minutes. */
export function estimateMinutes(words: number): number {
  return Math.max(5, Math.round(words / 180));
}

export type SplitOptions = {
  /** A run of text shorter than this is a heading block or front matter, not a chapter. */
  minWords?: number;
  /** Chapters longer than this are split again so a sitting stays a sitting. */
  maxWords?: number;
};

/**
 * Splits the work into chapters.
 *
 * A chapter longer than `maxWords` is divided at paragraph boundaries into parts, because a
 * 6,000-word chapter is not a twenty-minute reading slot however the author numbered it.
 *
 * @throws if no chapters can be found — better to look at the book than to serve one blob.
 */
export function splitIntoChapters(text: string, opts: SplitOptions = {}): ParsedChapter[] {
  const minWords = opts.minWords ?? 150;
  const maxWords = opts.maxWords ?? 3500;

  const lines = text.split("\n");
  const blocks: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const heading = headingFor(line);
    // A heading only counts when it sits alone — Gutenberg puts a blank line either side.
    if (heading) {
      if (current) blocks.push(current);
      const label = heading.title ? `${heading.label}. ${heading.title}` : `Chapter ${heading.label}`;
      current = { title: label, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);

  const chapters: ParsedChapter[] = [];
  for (const block of blocks) {
    const body = block.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const words = countWords(body);
    if (words < minWords) continue; // a heading with nothing under it, or front matter

    if (words <= maxWords) {
      chapters.push({ number: chapters.length + 1, title: block.title, body, wordCount: words });
      continue;
    }

    // Too long for one sitting: break it at paragraph boundaries.
    const paragraphs = body.split(/\n{2,}/);
    const parts: string[][] = [[]];
    let running = 0;
    for (const paragraph of paragraphs) {
      const size = countWords(paragraph);
      if (running > 0 && running + size > maxWords) {
        parts.push([]);
        running = 0;
      }
      parts[parts.length - 1].push(paragraph);
      running += size;
    }

    parts.forEach((part, i) => {
      const partBody = part.join("\n\n").trim();
      if (!partBody) return;
      chapters.push({
        number: chapters.length + 1,
        title: parts.length > 1 ? `${block.title} (part ${i + 1} of ${parts.length})` : block.title,
        body: partBody,
        wordCount: countWords(partBody),
      });
    });
  }

  if (chapters.length === 0) {
    throw new Error(
      "No chapters found. The text may use an unusual heading style — check it by hand before importing.",
    );
  }

  return chapters;
}

/** Where a Gutenberg ebook's plain text lives. Tried in order. */
export function gutenbergTextUrls(ebookId: string | number): string[] {
  const id = String(ebookId);
  return [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
  ];
}
