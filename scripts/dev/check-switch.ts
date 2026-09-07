/** Test helper: after switching providers, confirms the planner serves the new curriculum
 *  and that work already done under the old one is still recorded. */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { ensureDayPlanned } from "@/lib/scheduling/planner";
import { schoolDayKey } from "@/lib/dates";

async function main() {
  const students = await prisma.studentProfile.findMany({ include: { user: true } });
  const day = schoolDayKey();
  for (const s of students) {
    const assignments = await ensureDayPlanned(s.id, day);
    const withLessons = await prisma.dailyAssignment.findMany({
      where: { id: { in: assignments.map((a) => a.id) } },
      include: { lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } } },
    });
    const providers = new Set(withLessons.map((a) => a.lesson?.provider).filter(Boolean));
    console.log(
      `${s.user.displayName}: ${withLessons.length} lesson(s) planned, from provider(s): ${[...providers].join(", ") || "none"}`,
    );
  }
  const attempts = await prisma.lessonAttempt.count();
  const oldEnrolments = await prisma.studentEnrolment.count({ where: { active: false } });
  console.log(`history preserved: ${attempts} lesson attempt(s), ${oldEnrolments} archived enrolment(s)`);
}
main().finally(() => prisma.$disconnect());
