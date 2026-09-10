/**
 * Puts a new student on the curriculum.
 *
 * Creating an account is not the same as enrolling a child, but from a parent's side it very
 * much looks like it should be: they fill in a name and a year group and expect a school day.
 * Without enrolments and a weekly schedule the planner has nothing to plan, so a new child
 * opens Today to an empty page and no explanation.
 *
 * These are starting points, not decisions — a parent changes any of it in Schedule afterwards.
 */
import { prisma } from "@/lib/db";
import { syncProgramme } from "@/lib/curriculum/sync";

/** A sensible week for a child who has just been added. Mirrors what the seed sets up. */
const DEFAULT_SCHEDULE: { subject: string; weeklyFrequency: number; priority: number }[] = [
  { subject: "maths", weeklyFrequency: 5, priority: 3 },
  { subject: "english", weeklyFrequency: 5, priority: 2 },
  { subject: "science", weeklyFrequency: 3, priority: 1 },
  { subject: "history", weeklyFrequency: 2, priority: 1 },
  { subject: "geography", weeklyFrequency: 2, priority: 1 },
];

export type EnrolResult = { programmes: number; subjects: number };

/**
 * Enrols a student on every programme that exists for their year group, and gives them a
 * default week. Safe to run again: everything is an upsert, and a schedule a parent has since
 * changed is left alone.
 */
/**
 * The bundled placeholder curriculum.
 *
 * It exists so a fresh install has something to show. It is not real teaching material: its
 * lessons are invented, and its "videos" are `fixture://` addresses that point at nothing. A
 * child on it is doing made-up lessons with a broken video player, which is exactly what has
 * been happening.
 */
export const PLACEHOLDER_PROVIDER = "fixture";

/** Real material for a subject-year, if any exists. Placeholder only when nothing else does. */
async function bestProgrammesFor(yearGroup: number) {
  const all = await prisma.programme.findMany({ where: { yearGroup }, include: { subject: true } });

  const realBySlug = new Map<string, (typeof all)[number]>();
  for (const programme of all) {
    if (programme.provider === PLACEHOLDER_PROVIDER) continue;
    const current = realBySlug.get(programme.subject.slug);
    // Oak first where both exist: it is the material an actual teacher wrote.
    if (!current || (current.provider !== "oak" && programme.provider === "oak")) {
      realBySlug.set(programme.subject.slug, programme);
    }
  }

  return all.filter(
    (p) => p.provider !== PLACEHOLDER_PROVIDER || !realBySlug.has(p.subject.slug),
  );
}

export async function enrolStudentInYearGroup(studentId: string): Promise<EnrolResult> {
  const student = await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId } });

  const programmes = await bestProgrammesFor(student.yearGroup);

  let subjects = 0;
  for (const programme of programmes) {
    await prisma.studentEnrolment.upsert({
      where: { studentId_programmeId: { studentId, programmeId: programme.id } },
      create: { studentId, programmeId: programme.id },
      update: { active: true },
    });

    const rule = DEFAULT_SCHEDULE.find((r) => r.subject === programme.subject.slug);
    if (!rule) continue;

    /**
     * By subject name, not by row.
     *
     * Looking this up by `subjectId` alone is what put two Maths lines on a child's timetable:
     * moving them off the placeholder curriculum enrolled them on Oak's `maths` row, found no
     * schedule for *that* row, and added a second one beside the placeholder's. Matched on the
     * slug, an existing timetable line is recognised whichever provider's row it names — and
     * `alignSchedulesToEnrolments` moves it across.
     */
    const existing = await prisma.studentSchedule.findFirst({
      where: { studentId, subject: { slug: programme.subject.slug } },
    });
    // A parent who has already set this subject's frequency keeps their choice.
    if (existing) continue;

    await prisma.studentSchedule.create({
      data: {
        studentId,
        subjectId: programme.subjectId,
        weeklyFrequency: rule.weeklyFrequency,
        priority: rule.priority,
      },
    });
    subjects += 1;
  }

  return { programmes: programmes.length, subjects };
}

/**
 * Puts a child back on their own year group.
 *
 * Mikhael is in Year 4 and was enrolled on Year 5 programmes — my mistake, taken from a spec
 * and never checked. The visible symptom was a Year 4 nine-year-old being taught separating
 * mixtures, which is Year 5 science, and it would have gone on being wrong in every subject
 * every day.
 *
 * Enrolments on the wrong year are deactivated rather than deleted, because a child may have
 * done work against them and that history is not ours to erase. Their unstarted assignments go,
 * so tomorrow is not planned from the wrong year, and the right year is enrolled in their place.
 * Anything already started or finished stays exactly as it is.
 */
export async function fixYearGroupEnrolments(studentId: string): Promise<{ removed: number; added: number }> {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) return { removed: 0, added: 0 };

  const active = await prisma.studentEnrolment.findMany({
    where: { studentId, active: true },
    include: { programme: { include: { subject: true } } },
  });

  // Real material for the subjects this child is currently taking, so a placeholder enrolment
  // can be told apart from the only thing available.
  const real = await prisma.programme.findMany({
    where: {
      yearGroup: student.yearGroup,
      provider: { not: PLACEHOLDER_PROVIDER },
      subject: { slug: { in: active.map((e) => e.programme.subject.slug) } },
    },
    include: { subject: true },
  });
  const realSlugs = new Set(real.map((p) => p.subject.slug));

  const wrong = active.filter(
    (e) =>
      // The wrong year — a Year 4 child on Year 5 material.
      e.programme.yearGroup !== student.yearGroup ||
      // Or the bundled placeholders, when real material for that subject exists. Invented
      // lessons with `fixture://` videos are not a curriculum, and a child on them is being
      // given made-up work and a broken player.
      (e.programme.provider === PLACEHOLDER_PROVIDER && realSlugs.has(e.programme.subject.slug)),
  );
  if (wrong.length === 0) return { removed: 0, added: 0 };

  const lessons = await prisma.lesson.findMany({
    where: { unit: { programmeId: { in: wrong.map((e) => e.programmeId) } } },
    select: { id: true },
  });

  // Only what nobody has touched. Work already done against the wrong year is still work done,
  // and deleting a child's history to tidy up a mistake of mine would be a worse mistake.
  if (lessons.length > 0) {
    await prisma.dailyAssignment.deleteMany({
      where: { studentId, status: "PLANNED", lessonId: { in: lessons.map((l) => l.id) } },
    });
  }

  /**
   * Their own year has to have something in it before they are moved onto it.
   *
   * Mikhael was on Year 5 placeholders. Taking those away with no Year 4 material to replace
   * them leaves him with nothing at all, which is a worse day than the wrong one he had. So the
   * import is started, and the move waits for it to land.
   *
   * Started, not awaited. Importing five subjects is a couple of hundred requests to the
   * provider taking minutes, and this runs while a child is waiting for their page to render —
   * doing that work inline is how the server got taken down this morning. It runs behind the
   * page, and the next visit finds the material and completes the move.
   */
  const schedules = await prisma.studentSchedule.findMany({
    where: { studentId, active: true },
    include: { subject: true },
  });

  const missing: string[] = [];
  for (const schedule of schedules) {
    const exists = await prisma.programme.findFirst({
      where: {
        yearGroup: student.yearGroup,
        provider: { not: PLACEHOLDER_PROVIDER },
        subject: { slug: schedule.subject.slug },
      },
    });
    if (!exists) missing.push(schedule.subject.slug);
  }

  if (missing.length > 0) {
    void importYearInBackground(student.yearGroup, missing);
    // Nothing to move them onto yet. Leave them where they are — the wrong year taught is still
    // better than an empty timetable — and finish the job on the next visit.
    return { removed: 0, added: 0 };
  }

  await prisma.studentEnrolment.updateMany({
    where: { id: { in: wrong.map((e) => e.id) } },
    data: { active: false },
  });

  const { programmes } = await enrolStudentInYearGroup(studentId);
  return { removed: wrong.length, added: programmes };
}

/** Year groups already being imported, so a burst of page loads starts one job, not twenty. */
const importing = new Set<number>();

/**
 * Imports a year group's subjects without anybody waiting on it.
 *
 * Deliberately small per subject: enough to start a child off, with the ordinary weekly top-up
 * carrying on from there. The provider's quota is a fixed budget and a child needs the first
 * few lessons today far more than they need the whole year by tonight.
 */
async function importYearInBackground(yearGroup: number, subjectSlugs: string[]): Promise<void> {
  if (importing.has(yearGroup)) return;
  importing.add(yearGroup);
  try {
    for (const subjectSlug of subjectSlugs) {
      await syncProgramme({ subjectSlug, yearGroup }, { maxLessons: 6 }).catch(() => undefined);
    }
  } finally {
    importing.delete(yearGroup);
  }
}

/**
 * Points the timetable at the subjects the child is actually enrolled on.
 *
 * Two rows can be called Maths. `Subject` is unique on (provider, slug), so the bundled
 * placeholder curriculum has its own `maths/fixture` row and Oak has `maths/oak`. A timetable
 * written against one and an enrolment written against the other are, to the planner, two
 * unrelated subjects: `planWeek` matches on `subjectId`, finds no programme for the scheduled
 * subject, and plans nothing.
 *
 * That is exactly what happened to Mikhael. Moving him off the placeholders corrected his
 * enrolments and left his timetable pointing at the rows nobody teaches any more, so a child
 * with 240 Year 4 lessons waiting for him opened Today to an empty board. Nothing in the app
 * said why, because from every angle it looked correct — the subjects were there, the material
 * was there, and they could not see each other.
 *
 * So the timetable follows the enrolment. The parent's choices — how often, which days, what
 * order — are the part that matters and they are carried across unchanged; only the row the
 * subject points at changes. Where both rows are already scheduled the parent's settings win
 * and the orphan is retired, because two Maths lines on a timetable is one of them being wrong.
 */
export async function alignSchedulesToEnrolments(studentId: string): Promise<number> {
  const [allSchedules, enrolments] = await Promise.all([
    prisma.studentSchedule.findMany({ where: { studentId }, include: { subject: true } }),
    prisma.studentEnrolment.findMany({
      where: { studentId, active: true },
      include: { programme: { include: { subject: true } } },
    }),
  ]);
  if (allSchedules.length === 0 || enrolments.length === 0) return 0;

  const enrolledSubjectIds = new Set(enrolments.map((e) => e.programme.subjectId));
  // Where a slug has more than one enrolment, prefer the real material over the placeholder.
  const subjectIdBySlug = new Map<string, string>();
  for (const enrolment of enrolments) {
    const { slug, provider } = enrolment.programme.subject;
    const current = subjectIdBySlug.get(slug);
    if (!current || provider !== PLACEHOLDER_PROVIDER) subjectIdBySlug.set(slug, enrolment.programme.subjectId);
  }

  // Every row, active or not: the timetable is unique on (student, subject), so an old retired
  // row on the subject we are moving to would refuse the move rather than allow a duplicate.
  const bySubjectId = new Map(allSchedules.map((s) => [s.subjectId, s]));
  let moved = 0;

  for (const schedule of allSchedules) {
    if (!schedule.active) continue;
    if (enrolledSubjectIds.has(schedule.subjectId)) continue; // already pointing somewhere taught

    const target = subjectIdBySlug.get(schedule.subject.slug);
    if (!target || target === schedule.subjectId) continue; // nothing to move it to

    const occupant = bySubjectId.get(target);
    if (occupant?.active) {
      // Both rows are on the timetable — a duplicate of the same subject. The one that is
      // taught stays; this one is retired, not deleted, so a parent can see what happened.
      await prisma.studentSchedule.update({ where: { id: schedule.id }, data: { active: false } });
      moved += 1;
      continue;
    }

    if (occupant) {
      // A retired row already holds that subject. Give it this timetable's settings and bring
      // it back, so the parent's frequency and preferred days survive the move.
      await prisma.studentSchedule.update({
        where: { id: occupant.id },
        data: {
          active: true,
          weeklyFrequency: schedule.weeklyFrequency,
          priority: schedule.priority,
          preferredDays: schedule.preferredDays ?? [],
        },
      });
      await prisma.studentSchedule.update({ where: { id: schedule.id }, data: { active: false } });
      occupant.active = true;
      moved += 1;
      continue;
    }

    await prisma.studentSchedule.update({ where: { id: schedule.id }, data: { subjectId: target } });
    bySubjectId.delete(schedule.subjectId);
    bySubjectId.set(target, { ...schedule, subjectId: target });
    moved += 1;
  }

  return moved;
}
