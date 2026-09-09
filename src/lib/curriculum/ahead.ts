/**
 * Import the lessons the children are about to reach — and nothing else.
 *
 * Importing "the next 25 lessons of every subject" spends a quota window on material nobody
 * will open for a month, and still misses the one lesson that is on Tuesday. The timetable
 * already knows what is coming: each subject runs `weeklyFrequency` times a week, and the
 * planner takes the next incomplete lesson in the programme's sequence each time. So the
 * lessons a fortnight of school will actually use are computable exactly, per child.
 *
 * Two weeks, not one, deliberately: a run that fails on a Sunday must not leave a child with
 * an empty Wednesday. The second week is nearly free, because a lesson already imported costs
 * nothing to walk past.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getOrCreateExplainer } from "@/lib/lessons/explainer";
import { syncMany, type SyncScope } from "./sync";

/** How far ahead to keep the curriculum stocked. */
export const WEEKS_AHEAD = 2;

export interface AheadTarget extends SyncScope {
  subjectSlug: string;
  yearGroup: number;
  lessonSlugs: string[];
  /** The units those lessons live in, so a targeted run does not read every unit in the year. */
  unitSlugs: string[];
  /** Whose week this is, for the log a parent reads. */
  students: string[];
  /**
   * How many lessons this subject still needs that we do not yet know exist.
   *
   * A subject whose programme has no lessons in the database at all — or has run to the end of
   * what was imported — cannot be asked for by name, because we do not know the names. Eva had
   * two English and two maths periods in a day and no history, and this was why: the weekly
   * import only ever asked for lessons it could already see, so a subject with nothing imported
   * stayed empty forever and the planner filled her day by doubling up the subjects that had
   * something. Targets with `discover` set are imported by walking the programme instead.
   */
  discover: number;
}

/**
 * A lesson is ready when it can actually be taught: it has questions, and we have managed to
 * read its asset list at least once (so its video is either here or genuinely absent). This is
 * the same test the sync uses to decide what to skip — they must agree, or a lesson is either
 * fetched forever or never.
 */
function isReady(lesson: { assetsSyncedAt: Date | null; _count: { questions: number } }): boolean {
  return lesson.assetsSyncedAt !== null && lesson._count.questions > 0;
}

/**
 * The lessons every enrolled child will reach in the next `weeks` weeks and that are not yet
 * ready to teach, grouped into one sync scope per subject-year.
 */
export async function lessonsNeededAhead(weeks: number = WEEKS_AHEAD): Promise<AheadTarget[]> {
  const students = await prisma.studentProfile.findMany({
    include: { user: { select: { displayName: true } } },
  });

  // keyed by "<subjectSlug>:<yearGroup>"
  const byProgramme = new Map<string, AheadTarget>();

  for (const student of students) {
    const [enrolments, schedules] = await Promise.all([
      prisma.studentEnrolment.findMany({ where: { studentId: student.id, active: true } }),
      prisma.studentSchedule.findMany({ where: { studentId: student.id, active: true } }),
    ]);
    if (enrolments.length === 0 || schedules.length === 0) continue;

    const programmes = await prisma.programme.findMany({
      where: { id: { in: enrolments.map((e) => e.programmeId) } },
      include: { subject: { select: { slug: true } } },
    });
    const programmeBySubjectId = new Map(programmes.map((p) => [p.subjectId, p]));

    for (const schedule of schedules) {
      const programme = programmeBySubjectId.get(schedule.subjectId);
      if (!programme) continue;

      // The same order the planner walks: units by order, lessons by order, minus the ones
      // this child has finished. Any other order would import the wrong lessons.
      const units = await prisma.unit.findMany({
        where: { programmeId: programme.id },
        orderBy: { order: "asc" },
        select: {
          providerSlug: true,
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              providerSlug: true,
              assetsSyncedAt: true,
              _count: { select: { questions: true } },
            },
          },
        },
      });

      const sequence = units.flatMap((u) => u.lessons.map((l) => ({ ...l, unitSlug: u.providerSlug })));
      if (sequence.length === 0) continue;

      const done = await prisma.studentLessonProgress.findMany({
        where: {
          studentId: student.id,
          lessonId: { in: sequence.map((l) => l.id) },
          status: { in: ["COMPLETED", "MASTERED"] },
        },
        select: { lessonId: true },
      });
      const doneIds = new Set(done.map((p) => p.lessonId));

      const wanted = schedule.weeklyFrequency * weeks;
      const remaining = sequence.filter((l) => !doneIds.has(l.id));
      const upcoming = remaining.slice(0, wanted);

      const missing = upcoming.filter((l) => !isReady(l));
      // Lessons this child needs that we cannot name because they were never imported. Asking
      // for a subject's lessons by slug can only ever return lessons we already have, so a
      // subject that has run out — or never started — needs the programme walking instead.
      const shortfall = Math.max(0, wanted - remaining.length);

      if (missing.length === 0 && shortfall === 0) continue;

      const key = `${programme.subject.slug}:${programme.yearGroup}`;
      const target =
        byProgramme.get(key) ??
        ({
          subjectSlug: programme.subject.slug,
          yearGroup: programme.yearGroup,
          lessonSlugs: [],
          unitSlugs: [],
          students: [],
          discover: 0,
        } satisfies AheadTarget);

      for (const lesson of missing) {
        if (!target.lessonSlugs.includes(lesson.providerSlug)) target.lessonSlugs.push(lesson.providerSlug);
        if (!target.unitSlugs.includes(lesson.unitSlug)) target.unitSlugs.push(lesson.unitSlug);
      }
      // Two children on the same programme: take the larger shortfall, not the sum.
      target.discover = Math.max(target.discover, shortfall);
      if (!target.students.includes(student.user.displayName)) target.students.push(student.user.displayName);
      byProgramme.set(key, target);
    }
  }

  return [...byProgramme.values()];
}

export interface AheadResult {
  targets: AheadTarget[];
  jobIds: string[];
  failures: { scope: SyncScope; error: string }[];
  /** Every lesson the fortnight needs was already here. */
  nothingToDo: boolean;
}

/**
 * Imports exactly what the next `weeks` weeks of school will use.
 *
 * Safe to run every week, and safe to run twice in a day: a lesson that is already imported
 * with its assets is skipped without a provider request.
 */
export async function importLessonsAhead(
  opts: { weeks?: number; log?: (line: string) => void; skipExplainers?: boolean } = {},
): Promise<AheadResult> {
  const log = opts.log ?? (() => {});
  const targets = await lessonsNeededAhead(opts.weeks ?? WEEKS_AHEAD);

  if (targets.length === 0) {
    log("Every lesson the next two weeks need is already here. Nothing to import.");
    return { targets, jobIds: [], failures: [], nothingToDo: true };
  }

  const jobIds: string[] = [];
  const failures: { scope: SyncScope; error: string }[] = [];

  for (const t of targets) {
    log(
      `${t.subjectSlug} year ${t.yearGroup}: ${t.lessonSlugs.length} known lesson(s) to fetch` +
        (t.discover > 0 ? `, and ${t.discover} more to find` : "") +
        ` for ${t.students.join(" and ")}`,
    );

    // Named lessons first: they are the ones a child reaches soonest, and they cost one unit
    // read each rather than a walk of the year.
    if (t.lessonSlugs.length > 0) {
      const named = await syncMany(
        [{ subjectSlug: t.subjectSlug, yearGroup: t.yearGroup, lessonSlugs: t.lessonSlugs, unitSlugs: t.unitSlugs }],
        { log: opts.log },
      );
      jobIds.push(...named.jobIds);
      failures.push(...named.failures);
    }

    // Then whatever this subject is short of. No slug filter — we are looking for lessons we
    // have never seen — but bounded, so finding history's next three lessons cannot spend the
    // window that maths needs.
    if (t.discover > 0) {
      const found = await syncMany([{ subjectSlug: t.subjectSlug, yearGroup: t.yearGroup }], {
        log: opts.log,
        maxLessons: t.discover,
      });
      jobIds.push(...found.jobIds);
      failures.push(...found.failures);
    }
  }

  for (const f of failures) {
    log(`FAILED ${f.scope.subjectSlug} year ${f.scope.yearGroup}: ${f.error}`);
  }

  // Writing lessons out is the slow half — a strong-model call each. When children are waiting
  // on a timetable, getting the lessons in is the urgent thing and the words can follow when
  // they open one.
  if (!opts.skipExplainers) {
    const written = await writeExplainersFor(targets, log);
    if (written > 0) log(`Wrote ${written} lesson(s) out in words, ready to open.`);
  }

  return { targets, jobIds, failures, nothingToDo: false };
}

/**
 * Writes out, ahead of time, the lessons that were just imported.
 *
 * A child opening Monday's lesson should not watch a spinner saying her teacher is writing it.
 * The work is the same either way; doing it on Sunday means nobody waits for it. Failures are
 * ignored on purpose — the lesson page writes it on demand if this did not get to it.
 */
async function writeExplainersFor(targets: AheadTarget[], log: (line: string) => void): Promise<number> {
  const slugs = targets.flatMap((t) => t.lessonSlugs);
  if (slugs.length === 0) return 0;

  const lessons = await prisma.lesson.findMany({
    where: { providerSlug: { in: slugs }, explainer: { equals: Prisma.DbNull } },
    select: { id: true, title: true },
  });

  let written = 0;
  for (const lesson of lessons) {
    try {
      const explainer = await getOrCreateExplainer(lesson.id);
      if (explainer) written += 1;
    } catch (err) {
      log(`  Could not write out "${lesson.title}": ${(err as Error).message}`);
    }
  }
  return written;
}
