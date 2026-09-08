/**
 * Imports books from `fixtures/books/candidates.json` into the reading library.
 *
 *   pnpm books:import                    # every candidate not already imported
 *   pnpm books:import --title "Treasure" # just the ones whose title matches
 *   pnpm books:import --year 5           # just one year group
 *   pnpm books:import --force            # re-download books already imported
 *   pnpm books:import --activate "Black Beauty"   # set the class novel afterwards
 *
 * Needs outbound access to gutenberg.org, so it is meant to be run where the app is deployed.
 * Every failure is reported per book and never stops the others.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { importBook, isPublicDomainHere, setActiveBook, slugify, bookCandidateSchema } from "@/lib/books/import";
import { z } from "zod";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const file = path.resolve(process.cwd(), "fixtures/books/candidates.json");
  if (!fs.existsSync(file)) throw new Error(`No candidate list at ${file}`);

  const all = z.array(bookCandidateSchema).parse(JSON.parse(fs.readFileSync(file, "utf8")));

  const titleFilter = arg("title")?.toLowerCase();
  const yearFilter = arg("year") ? Number(arg("year")) : undefined;
  const force = has("force");

  let candidates = all;
  if (titleFilter) candidates = candidates.filter((c) => c.title.toLowerCase().includes(titleFilter));
  if (yearFilter) candidates = candidates.filter((c) => c.yearGroup === yearFilter);

  // Refuse anything that does not clear UK/Canada life + 70, before touching the network.
  const blocked = candidates.filter((c) => !isPublicDomainHere(c.authorDeathYear));
  for (const c of blocked) {
    console.error(`[books] SKIP ${c.title} — author death year ${c.authorDeathYear ?? "unknown"} fails life+70.`);
  }
  candidates = candidates.filter((c) => isPublicDomainHere(c.authorDeathYear));

  if (!force) {
    const already = await prisma.book.findMany({ select: { slug: true } });
    const have = new Set(already.map((b) => b.slug));
    const before = candidates.length;
    candidates = candidates.filter((c) => !have.has(slugify(c.title)));
    if (before !== candidates.length) {
      console.log(`[books] ${before - candidates.length} already imported — use --force to redo them.`);
    }
  }

  console.log(`[books] importing ${candidates.length} book(s)…`);
  let ok = 0;
  const failures: string[] = [];

  for (const candidate of candidates) {
    try {
      const result = await importBook(candidate);
      ok++;
      console.log(
        `[books] ✓ ${result.book.title} — ${result.chapters} chapters, ${result.words.toLocaleString()} words`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${candidate.title}: ${message}`);
      console.error(`[books] ✗ ${candidate.title}\n        ${message.replace(/\n/g, "\n        ")}`);
    }
  }

  const activate = arg("activate");
  if (activate) {
    const book = await prisma.book.findFirst({
      where: { title: { contains: activate, mode: "insensitive" } },
    });
    if (book) {
      await setActiveBook(book.id);
      console.log(`[books] "${book.title}" is now the class novel for Year ${book.yearGroup}.`);
    } else {
      console.error(`[books] no imported book matching "${activate}".`);
    }
  }

  const total = await prisma.book.count();
  const chapters = await prisma.readingText.count({ where: { bookId: { not: null } } });
  console.log(`[books] done: ${ok} imported this run. Library holds ${total} book(s), ${chapters} chapters.`);
  if (failures.length) {
    console.log(`[books] ${failures.length} failed — see above. Nothing else was affected.`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
