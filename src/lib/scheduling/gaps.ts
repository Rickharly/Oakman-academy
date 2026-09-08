/**
 * Why a child's day looks the way it does.
 *
 * "Eva has two English, two maths and one science — why?" is a question that has been asked
 * four times, and each time the answer was buried in a database nobody but the server can see.
 * The planner fills a day to a full timetable; when a subject has no lesson to give, it takes
 * one from a subject that does. That is the right behaviour — a child should not sit in front
 * of an empty period — but it is silent, so a subject quietly disappearing from the week looks
 * like the planner misbehaving rather than a subject having run out of material.
 *
 * This says which subject can supply a lesson, which cannot, and why not, in the words a
 * parent would use.
 */
import { prisma } from "@/lib/db";

export interface SubjectSupply {
  subjectTitle: string;
  /** Periods a week this subject is supposed to get. */
  weeklyFrequency: number;
  /** Lessons imported for the programme this child is on. */
  lessonsImported: number;
  /** Of those, how many they have finished. */
  lessonsDone: number;
  /** Lessons left that they have not done. */
  lessonsLeft: number;
  /** True when this subject can supply its next period. */
  healthy: boolean;
  /** In plain words, when it cannot. */
  problem: string | null;
}

export async function subjectSupply(studentId: string): Promise<SubjectSupply[]> {
  const [schedules, enrolments] = await Promise.all([
    prisma.studentSchedule.findMany({
      where: { studentId, active: true },
      include: { subject: true },
      orderBy: [{ priority: "desc" }],
    }),
    prisma.studentEnrolment.findMany({ where: { studentId, active: true } }),
  ]);

  const programmes = enrolments.length
    ? await prisma.programme.findMany({ where: { id: { in: enrolments.map((e) => e.programmeId) } } })
    : [];
  const programmeBySubject = new Map(programmes.map((p) => [p.subjectId, p]));

  const rows: SubjectSupply[] = [];

  for (const schedule of schedules) {
    const programme = programmeBySubject.get(schedule.subjectId);

    if (!programme) {
      rows.push({
        subjectTitle: schedule.subject.title,
        weeklyFrequency: schedule.weeklyFrequency,
        lessonsImported: 0,
        lessonsDone: 0,
        lessonsLeft: 0,
        healthy: false,
        problem:
          "On the timetable but not enrolled on a programme, so the planner has nowhere to take a lesson from.",
      });
      continue;
    }

    const lessons = await prisma.lesson.findMany({
      where: { unit: { programmeId: programme.id } },
      select: { id: true },
    });
    const done = lessons.length
      ? await prisma.studentLessonProgress.count({
          where: {
            studentId,
            lessonId: { in: lessons.map((l) => l.id) },
            status: { in: ["COMPLETED", "MASTERED"] },
          },
        })
      : 0;
    const left = lessons.length - done;

    let problem: string | null = null;
    if (lessons.length === 0) {
      problem = "No lessons imported for this subject yet, so its periods get filled by other subjects.";
    } else if (left === 0) {
      problem = "Every imported lesson has been done. Import more, or this subject drops out of the week.";
    } else if (left < schedule.weeklyFrequency) {
      problem = `Only ${left} lesson${left === 1 ? "" : "s"} left — fewer than the ${schedule.weeklyFrequency} periods a week it is meant to get.`;
    }

    rows.push({
      subjectTitle: schedule.subject.title,
      weeklyFrequency: schedule.weeklyFrequency,
      lessonsImported: lessons.length,
      lessonsDone: done,
      lessonsLeft: left,
      healthy: problem === null,
      problem,
    });
  }

  return rows;
}
