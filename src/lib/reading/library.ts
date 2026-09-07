/**
 * Loads the reading library from `fixtures/reading/year-*.json` into `ReadingText`.
 *
 * The passages are original writing bundled with the app rather than pulled from a provider:
 * a reading lesson needs the text on screen, and reproducing published books would not be
 * ours to do. Seeding is an idempotent upsert by slug, so adding a passage to a fixture file
 * and redeploying is all it takes to put it in front of a child.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { prisma } from "@/lib/db";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** src/lib/reading -> project root -> fixtures/reading */
const FIXTURES_DIR = path.resolve(HERE, "../../../fixtures/reading");

const readingTextSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1).default("Oakman Academy"),
  yearGroup: z.number().int().min(1).max(13),
  order: z.number().int().min(1),
  genre: z.enum(["fiction", "non-fiction", "poetry"]),
  body: z.string().min(1),
  wordCount: z.number().int().min(1).optional(),
  estimatedMinutes: z.number().int().min(1).max(120).default(15),
  prompts: z.array(z.string().min(1)).min(1),
  essayPrompt: z.string().min(1).nullable().default(null),
  vocabulary: z.array(z.object({ word: z.string().min(1), meaning: z.string().min(1) })).default([]),
});

export type ReadingTextFixture = z.infer<typeof readingTextSchema>;

function countWords(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}

export function loadReadingFixtures(dir = FIXTURES_DIR): ReadingTextFixture[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

  const texts: ReadingTextFixture[] = [];
  for (const file of files) {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const rows = z.array(readingTextSchema).parse(raw);
    texts.push(...rows);
  }

  const seen = new Set<string>();
  for (const text of texts) {
    if (seen.has(text.slug)) throw new Error(`Duplicate reading slug: ${text.slug}`);
    seen.add(text.slug);
  }
  return texts;
}

/** Upserts every bundled passage. Returns how many rows the library now holds. */
export async function seedReadingLibrary(dir = FIXTURES_DIR): Promise<number> {
  const texts = loadReadingFixtures(dir);

  for (const text of texts) {
    const data = {
      title: text.title,
      author: text.author,
      yearGroup: text.yearGroup,
      order: text.order,
      genre: text.genre,
      body: text.body,
      // Trust the passage, not the hand-written count.
      wordCount: countWords(text.body),
      estimatedMinutes: text.estimatedMinutes,
      prompts: text.prompts,
      essayPrompt: text.essayPrompt,
      vocabulary: text.vocabulary,
    };
    await prisma.readingText.upsert({
      where: { slug: text.slug },
      create: { slug: text.slug, ...data },
      update: data,
    });
  }

  return prisma.readingText.count();
}
