import "dotenv/config";
import { prisma } from "@/lib/db";
import { ensureDayPlanned } from "@/lib/scheduling/planner";
import { dateOnlyKey, todayDateOnly } from "@/lib/dates";

async function main() {
  const todayKey = dateOnlyKey(todayDateOnly());
  const students = await prisma.studentProfile.findMany({ include: { user: true } });

  if (students.length === 0) {
    console.log("No students found.");
    return;
  }

  for (const student of students) {
    const assignments = await ensureDayPlanned(student.id, todayKey);
    console.log(`\n${student.user.displayName} (Year ${student.yearGroup}) — ${todayKey}`);
    if (assignments.length === 0) {
      console.log("  (nothing planned)");
      continue;
    }
    for (const a of assignments) {
      const label = a.customTitle ?? a.lessonId ?? `${a.kind} ${a.id}`;
      const flags = [a.optional ? "optional" : null, a.status === "MOVED" ? `moved → ${a.movedToDate?.toISOString().slice(0, 10)}` : null]
        .filter(Boolean)
        .join(", ");
      console.log(`  [${a.status}] ${a.kind} ${label} (${a.estimatedMinutes}m)${flags ? ` (${flags})` : ""}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
