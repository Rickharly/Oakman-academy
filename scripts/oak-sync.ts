/**
 * Imports curriculum from Oak National Academy, and (optionally) moves the students onto it.
 *
 *   pnpm oak:sync                          # every subject, for each student's year group
 *   pnpm oak:sync --year 7                 # every subject for year 7
 *   pnpm oak:sync --subject maths --year 7
 *   pnpm oak:sync --assets                 # also download worksheets/slides to ASSET_STORAGE_DIR
 *   pnpm oak:sync --switch                 # after syncing, enrol the students on the Oak
 *                                          # programmes and repoint their weekly schedule
 *   pnpm oak:sync --switch-only            # skip the import, just move the students over
 *
 * Needs OAK_API_KEY. Nothing here touches learning history: work already done against the
 * bundled curriculum keeps its attempts, marks and mastery, and stays visible in Admin.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { OakProvider } from "@/lib/curriculum/oak-provider";
import { syncMany, type SyncScope } from "@/lib/curriculum/sync";

const SUBJECTS = ["maths", "english", "science", "history", "geography"] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/**
 * Moves each student from whichever programme they are on to the Oak programme for the same
 * subject and year, and repoints their weekly schedule at the Oak subject rows.
 *
 * Without this, syncing Oak quietly changes nothing the children see: the sync creates new
 * `Programme` and `Subject` rows under the `oak` provider, while their enrolments and
 * schedule still point at the bundled ones.
 */
async function switchStudentsToOak(): Promise<void> {
  const students = await prisma.studentProfile.findMany({
    include: {
      user: true,
      enrolments: { include: { programme: { include: { subject: true } } } },
      schedules: { include: { subject: true } },
    },
  });

  for (const student of students) {
    let moved = 0;

    for (const enrolment of student.enrolments.filter((e) => e.active)) {
      const { subject, yearGroup } = enrolment.programme;
      if (enrolment.programme.provider === "oak") continue;

      const oakProgramme = await prisma.programme.findFirst({
        where: { provider: "oak", yearGroup, subject: { slug: subject.slug, provider: "oak" } },
        include: { subject: true },
      });
      if (!oakProgramme) {
        console.warn(
          `  ${student.user.displayName}: no Oak programme for ${subject.slug} year ${yearGroup} — left on the bundled one`,
        );
        continue;
      }

      await prisma.studentEnrolment.upsert({
        where: { studentId_programmeId: { studentId: student.id, programmeId: oakProgramme.id } },
        create: { studentId: student.id, programmeId: oakProgramme.id },
        update: { active: true },
      });
      // The old enrolment is deactivated, never deleted: the lessons already completed under
      // it stay attached to it and keep showing in progress and reports.
      await prisma.studentEnrolment.update({ where: { id: enrolment.id }, data: { active: false } });

      // Repoint the weekly schedule at the Oak subject, carrying the frequency across.
      const rule = student.schedules.find((s) => s.subjectId === subject.id);
      if (rule) {
        await prisma.studentSchedule.upsert({
          where: { studentId_subjectId: { studentId: student.id, subjectId: oakProgramme.subjectId } },
          create: {
            studentId: student.id,
            subjectId: oakProgramme.subjectId,
            weeklyFrequency: rule.weeklyFrequency,
            preferredDays: rule.preferredDays as object,
            priority: rule.priority,
          },
          update: { weeklyFrequency: rule.weeklyFrequency, priority: rule.priority, active: true },
        });
        await prisma.studentSchedule.update({ where: { id: rule.id }, data: { active: false } });
      }

      moved += 1;
    }

    console.log(`  ${student.user.displayName} (year ${student.yearGroup}): ${moved} subject(s) moved to Oak`);
  }

  // Today's plan was built from the old programmes; drop the not-yet-started auto rows so the
  // next visit to Today re-plans against Oak. Anything in progress or completed is untouched.
  const removed = await prisma.dailyAssignment.deleteMany({
    where: { status: "PLANNED", source: "AUTO", date: { gte: new Date(new Date().toDateString()) } },
  });
  console.log(`  cleared ${removed.count} not-yet-started assignment(s) so they re-plan from Oak`);
}

async function main() {
  const switchOnly = flag("switch-only");

  if (!switchOnly) {
    const apiKey = process.env.OAK_API_KEY;
    if (!apiKey) {
      console.error(
        "OAK_API_KEY is not set. Get a free key at https://open-api.thenational.academy/docs/about-oaks-api/api-keys",
      );
      process.exitCode = 1;
      return;
    }

    const provider = new OakProvider({ apiKey, baseUrl: process.env.OAK_API_URL });
    const subject = arg("subject");
    const yearArg = arg("year");
    const includeAssets = flag("assets");

    let scopes: SyncScope[];
    if (yearArg) {
      const yearGroup = Number(yearArg);
      scopes = (subject ? [subject] : [...SUBJECTS]).map((s) => ({
        subjectSlug: s,
        yearGroup,
        includeAssets,
      }));
    } else {
      // Default: whatever the students actually need.
      const years = [
        ...new Set((await prisma.studentProfile.findMany({ select: { yearGroup: true } })).map((s) => s.yearGroup)),
      ];
      if (years.length === 0) {
        console.error("No students yet — run `pnpm db:seed` first, or pass --year.");
        process.exitCode = 1;
        return;
      }
      scopes = years.flatMap((yearGroup) =>
        (subject ? [subject] : [...SUBJECTS]).map((s) => ({ subjectSlug: s, yearGroup, includeAssets })),
      );
    }

    console.log(`Importing ${scopes.length} programme(s) from Oak…`);
    const maxLessons = Number(arg("max-lessons") ?? "") || undefined;
    const { programmeIds, failures } = await syncMany(scopes, {
      maxLessons,
      provider,
      log: (line) => console.log(`  ${line}`),
    });
    console.log(`Imported ${programmeIds.length} programme(s), ${failures.length} failed.`);
    for (const f of failures) {
      console.warn(`  ${f.scope.subjectSlug} year ${f.scope.yearGroup}: ${f.error}`);
    }
    if (programmeIds.length === 0) {
      console.error("Nothing imported — not moving the students.");
      process.exitCode = 1;
      return;
    }
  }

  if (flag("switch") || switchOnly) {
    console.log("Moving students onto the Oak curriculum…");
    await switchStudentsToOak();
    console.log("Done. Set CURRICULUM_PROVIDER=oak so future syncs use Oak too.");
  } else {
    console.log("Curriculum imported. Re-run with --switch to move the students onto it.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
