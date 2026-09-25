/**
 * The week the family has decided on.
 *
 * The default week was five subjects taken straight from the English national curriculum, which
 * is a reasonable starting point and not what this family wants. They are homeschooling on
 * purpose: English and maths carry the most weight, writing is its own craft rather than
 * something squeezed into comprehension, logic is worth an hour a week even though no
 * curriculum asks for it, and history and geography are worth having without being worth a
 * fifth of the week.
 *
 * Twenty-five periods, five a day, one subject per day each — which is what the planner
 * enforces, so the frequencies have to add up to exactly the week.
 */
import { prisma } from "@/lib/db";
import { GENERATED_PROVIDER, generateLessons } from "@/lib/curriculum/generate";

export interface TimetableRow {
  subject: string;
  title: string;
  weeklyFrequency: number;
  /** Higher goes first in the day, while they are freshest. */
  priority: number;
}

export const CORE_TIMETABLE: TimetableRow[] = [
  { subject: "maths", title: "Maths", weeklyFrequency: 5, priority: 5 },
  { subject: "english", title: "English", weeklyFrequency: 5, priority: 4 },
  // Writing every day, and separately from English. Being able to read a passage and being able
  // to write a paragraph are different skills, and the second one only gets taught if it has a
  // period of its own.
  { subject: "writing", title: "Writing", weeklyFrequency: 5, priority: 3 },
  { subject: "logic", title: "Logic", weeklyFrequency: 3, priority: 2 },
  { subject: "science", title: "Science", weeklyFrequency: 3, priority: 2 },
  { subject: "history", title: "History", weeklyFrequency: 2, priority: 1 },
  { subject: "geography", title: "Geography", weeklyFrequency: 2, priority: 1 },
];

/** 5 × 5. If this stops being true the planner will quietly drop whatever does not fit. */
export const PERIODS_PER_WEEK = CORE_TIMETABLE.reduce((n, r) => n + r.weeklyFrequency, 0);

/** Subjects nobody else provides, so we write them ourselves. */
const WRITTEN_HERE = new Set(["writing", "logic"]);

/**
 * A programme for this subject and year, made if it does not exist.
 *
 * Oak's is preferred wherever it has one. For writing and logic it never will, so the first
 * few lessons are written here — enough to start, with the ordinary top-up carrying on.
 */
async function ensureProgramme(subjectSlug: string, title: string, yearGroup: number) {
  const existing = await prisma.programme.findFirst({
    where: { yearGroup, subject: { slug: subjectSlug }, provider: { not: "fixture" } },
    orderBy: { provider: "asc" },
  });
  if (existing) return existing;

  if (!WRITTEN_HERE.has(subjectSlug)) return null; // Oak's to supply; not ours to invent.

  // The row first, so the background job finds it rather than racing to make its own.
  await findOrCreateSubject(subjectSlug, title);

  // Writing the first lessons is several model calls. Started, never awaited: this runs while a
  // parent is looking at a settings page, and blocking that on a minute of generation is how
  // the server got taken down twice.
  void generateLessons(subjectSlug, yearGroup, 6).catch(() => undefined);
  return null;
}


/**
 * The subject row for a slug, creating one only if nothing anywhere has it.
 *
 * Tolerant of losing a race, on purpose. Writing the first lessons for a new subject runs in
 * the background and creates the same row, so two runs a second apart collide — and the loser
 * used to throw a unique-constraint error out of a button a parent had just pressed twice.
 * Somebody else having created exactly the row we wanted is a success, not a failure.
 */
async function findOrCreateSubject(slug: string, title: string) {
  const existing = await prisma.subject.findFirst({ where: { slug }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  try {
    return await prisma.subject.create({
      data: { provider: GENERATED_PROVIDER, slug, title },
    });
  } catch {
    const raced = await prisma.subject.findFirst({ where: { slug }, orderBy: { createdAt: "asc" } });
    if (raced) return raced;
    throw new Error(`Could not create the subject "${slug}"`);
  }
}

export interface TimetableResult {
  scheduled: number;
  awaitingMaterial: string[];
}

/**
 * Puts a child on the family's week.
 *
 * Safe to run repeatedly. A subject whose material does not exist yet is still put on the
 * timetable and reported as waiting — the planner simply skips it until lessons arrive, which
 * is better than pretending the subject was never asked for.
 */
export async function applyCoreTimetable(studentId: string): Promise<TimetableResult> {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) return { scheduled: 0, awaitingMaterial: [] };

  const awaiting: string[] = [];
  let scheduled = 0;

  for (const row of CORE_TIMETABLE) {
    const programme = await ensureProgramme(row.subject, row.title, student.yearGroup);

    const subject = await findOrCreateSubject(row.subject, row.title);

    if (programme) {
      await prisma.studentEnrolment.upsert({
        where: { studentId_programmeId: { studentId, programmeId: programme.id } },
        create: { studentId, programmeId: programme.id },
        update: { active: true },
      });
    } else {
      awaiting.push(row.title);
    }

    // Matched by name, not by row: the same subject can exist under several providers, and a
    // second timetable line for "Maths" is how a child ended up with two of them.
    const existing = await prisma.studentSchedule.findFirst({
      where: { studentId, subject: { slug: row.subject } },
    });

    if (existing) {
      await prisma.studentSchedule.update({
        where: { id: existing.id },
        data: {
          weeklyFrequency: row.weeklyFrequency,
          priority: row.priority,
          active: true,
          subjectId: programme?.subjectId ?? existing.subjectId,
        },
      });
    } else {
      await prisma.studentSchedule.create({
        data: {
          studentId,
          subjectId: programme?.subjectId ?? subject.id,
          weeklyFrequency: row.weeklyFrequency,
          priority: row.priority,
        },
      });
    }
    scheduled += 1;
  }

  /**
   * Anything not on the family's week is retired, not deleted.
   *
   * Otherwise the old five-subject default sits underneath this one and the planner keeps
   * offering subjects nobody asked for, which is indistinguishable from the app ignoring the
   * timetable entirely.
   */
  const keep = new Set(CORE_TIMETABLE.map((r) => r.subject));
  const all = await prisma.studentSchedule.findMany({
    where: { studentId, active: true },
    include: { subject: true },
  });
  for (const schedule of all) {
    if (keep.has(schedule.subject.slug)) continue;
    await prisma.studentSchedule.update({ where: { id: schedule.id }, data: { active: false } });
  }

  return { scheduled, awaitingMaterial: awaiting };
}
