/**
 * Imports the lessons the next two weeks of school will actually use.
 *
 * Run weekly (Railway cron: `pnpm oak:week`, Sundays). Safe to run again the same day — a
 * lesson already imported with its assets costs no provider request.
 */
import "dotenv/config";
import { importLessonsAhead } from "../src/lib/curriculum/ahead";

async function main() {
  const result = await importLessonsAhead({ log: (line) => console.log(line) });

  if (result.failures.length > 0) {
    // A failure here means a child may open a lesson with nothing in it. Exit non-zero so the
    // scheduler reports it rather than logging into the void.
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/db");
    await prisma.$disconnect();
  });
