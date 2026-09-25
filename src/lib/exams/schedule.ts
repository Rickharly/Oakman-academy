/**
 * Putting the exam on the day.
 *
 * Friday is exam day: everything covered that week, sat without help. The first one a child
 * ever sits covers everything they have studied so far, because a school that has been running
 * three weeks without ever checking what stuck does not know what it has taught.
 *
 * The exam takes the first period of the day and the rest of the day is ordinary lessons. It is
 * built from work already done, so a week with nothing behind it simply has no exam — a quiet
 * Friday, not an error.
 */
import { prisma } from "@/lib/db";
import { isoWeekday, toDateOnly, weekStartKey } from "@/lib/dates";
import { buildExam } from "./service";

const EXAM_MINUTES = 40;

/** Monday of this week, as a Date, for "what did we cover since". */
function weekStartDate(dateKey: string): Date {
  return toDateOnly(weekStartKey(dateKey));
}

/**
 * Makes sure this child has their exam on the board, if today is a day for one.
 *
 * Idempotent: an exam already on today's board is left exactly as it is, mid-paper or finished.
 */
export async function ensureExamForDay(studentId: string, dateKey: string): Promise<void> {
  if (isoWeekday(dateKey) !== 5) return; // Fridays

  const date = toDateOnly(dateKey);
  const existing = await prisma.dailyAssignment.findFirst({
    where: { studentId, date, kind: "EXAM", status: { not: "MOVED" } },
  });
  if (existing) return;

  /**
   * The first exam covers everything, not just this week.
   *
   * Three weeks of lessons had gone by with no exam at all, so the first paper is a catch-up:
   * everything studied so far. Every Friday after that is the week just gone.
   */
  const everSat = await prisma.exam.count({ where: { studentId } });
  const kind = everSat === 0 ? "CATCH_UP" : "WEEKLY";

  const exam = await buildExam(studentId, {
    kind,
    from: kind === "CATCH_UP" ? null : weekStartDate(dateKey),
    to: new Date(),
    title: kind === "CATCH_UP" ? "Everything so far" : "This week's exam",
  });
  // Nothing studied yet: a quiet Friday is the right answer, not an empty paper.
  if (!exam) return;

  await prisma.dailyAssignment.create({
    data: {
      studentId,
      date,
      // First thing, while they are fresh, and before the day's teaching can coach them.
      order: -1,
      kind: "EXAM",
      source: "AUTO",
      status: "PLANNED",
      examId: exam.id,
      customTitle: exam.title,
      estimatedMinutes: EXAM_MINUTES,
    },
  });
}
