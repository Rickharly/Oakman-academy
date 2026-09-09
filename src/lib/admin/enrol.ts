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
export async function enrolStudentInYearGroup(studentId: string): Promise<EnrolResult> {
  const student = await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId } });

  const programmes = await prisma.programme.findMany({
    where: { yearGroup: student.yearGroup },
    include: { subject: true },
  });

  let subjects = 0;
  for (const programme of programmes) {
    await prisma.studentEnrolment.upsert({
      where: { studentId_programmeId: { studentId, programmeId: programme.id } },
      create: { studentId, programmeId: programme.id },
      update: { active: true },
    });

    const rule = DEFAULT_SCHEDULE.find((r) => r.subject === programme.subject.slug);
    if (!rule) continue;

    const existing = await prisma.studentSchedule.findUnique({
      where: { studentId_subjectId: { studentId, subjectId: programme.subjectId } },
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

  const wrong = await prisma.studentEnrolment.findMany({
    where: { studentId, active: true, programme: { yearGroup: { not: student.yearGroup } } },
    include: { programme: true },
  });
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

  await prisma.studentEnrolment.updateMany({
    where: { id: { in: wrong.map((e) => e.id) } },
    data: { active: false },
  });

  const { programmes } = await enrolStudentInYearGroup(studentId);
  return { removed: wrong.length, added: programmes };
}
