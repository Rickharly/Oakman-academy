/** Test helper: prints which provider each student's active enrolments and schedules point at. */
import "dotenv/config";
import { prisma } from "@/lib/db";

async function main() {
  const e = await prisma.studentEnrolment.findMany({ where: { active: true }, include: { programme: true } });
  const s = await prisma.studentSchedule.findMany({ where: { active: true }, include: { subject: true } });
  const by = <T,>(rows: T[], key: (r: T) => string) =>
    rows.reduce<Record<string, number>>((a, r) => ((a[key(r)] = (a[key(r)] ?? 0) + 1), a), {});
  console.log("active enrolments:", by(e, (x) => x.programme.provider));
  console.log("active schedules: ", by(s, (x) => x.subject.provider));
}
main().finally(() => prisma.$disconnect());
