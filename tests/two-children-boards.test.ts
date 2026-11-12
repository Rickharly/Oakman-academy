import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { applyCoreTimetable, CORE_TIMETABLE } from "@/lib/admin/timetable";
import { ensureDayPlanned } from "@/lib/scheduling/planner";
import { GENERATED_PROVIDER } from "@/lib/curriculum/generate";
import { schoolDayKey, toDateOnly } from "@/lib/dates";
import { boardsSideBySideCheck } from "@/lib/admin/diagnostics";

// Nothing in here may reach a real provider.
vi.mock("@/lib/curriculum/sync", async (orig) => ({
  ...(await orig<typeof import("@/lib/curriculum/sync")>()),
  syncProgramme: vi.fn(async () => ({ lessons: 0 })),
  ensureLessonAssets: vi.fn(async () => ({ outcome: "skipped" })),
}));

/**
 * "The kids have the same classes."
 *
 * Eva is Year 7, Mikhael is Year 4. Their boards share a timetable shape on purpose (the family's
 * week), but never the same lesson: each child is taught from their own year.
 */
async function curriculumFor(yearGroup: number) {
  for (const row of CORE_TIMETABLE) {
    const provider = row.subject === "writing" || row.subject === "logic" ? GENERATED_PROVIDER : "oak";
    const subject =
      (await prisma.subject.findFirst({ where: { slug: row.subject } })) ??
      (await prisma.subject.create({ data: { provider, slug: row.subject, title: row.title } }));
    const programme = await prisma.programme.create({
      data: {
        provider,
        providerSlug: `${row.subject}:${yearGroup}`,
        subjectId: subject.id,
        yearGroup,
        keyStage: yearGroup <= 6 ? "ks2" : "ks3",
        title: `${row.title} — Year ${yearGroup}`,
      },
    });
    const unit = await prisma.unit.create({
      data: { provider, providerSlug: `${row.subject}-y${yearGroup}-u1`, programmeId: programme.id, title: "Unit 1", order: 1 },
    });
    for (let i = 1; i <= 12; i += 1) {
      await prisma.lesson.create({
        data: {
          provider,
          providerSlug: `${row.subject}-y${yearGroup}-l${i}`,
          unitId: unit.id,
          title: `Y${yearGroup} ${row.title} lesson ${i}`,
          order: i,
          keyLearningPoints: [`Year ${yearGroup} ${row.subject} idea number ${i}`],
        },
      });
    }
  }
}

async function child(username: string, yearGroup: number) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username, passwordHash: "x", displayName: username },
  });
  return prisma.studentProfile.create({
    data: { userId: user.id, yearGroup, keyStage: yearGroup <= 6 ? "ks2" : "ks3" },
  });
}

describe("two children, two years", () => {
  beforeEach(async () => {
    await resetDb();
    await curriculumFor(4);
    await curriculumFor(7);
  });

  it("gives each child lessons from their own year, never the other's", async () => {
    const eva = await child("eva", 7);
    const mikhael = await child("mikhael", 4);
    await applyCoreTimetable(eva.id);
    await applyCoreTimetable(mikhael.id);

    const day = schoolDayKey();
    await ensureDayPlanned(eva.id, day);
    await ensureDayPlanned(mikhael.id, day);

    const board = (studentId: string) =>
      prisma.dailyAssignment.findMany({
        where: { studentId, date: toDateOnly(day), kind: "LESSON" },
        include: { lesson: { include: { unit: { include: { programme: true } } } } },
      });
    const evaBoard = await board(eva.id);
    const mikBoard = await board(mikhael.id);

    expect(evaBoard.length).toBeGreaterThan(0);
    expect(mikBoard.length).toBeGreaterThan(0);
    for (const a of evaBoard) expect(a.lesson?.unit.programme.yearGroup).toBe(7);
    for (const a of mikBoard) expect(a.lesson?.unit.programme.yearGroup).toBe(4);

    const shared = evaBoard.filter((a) => mikBoard.some((b) => b.lessonId === a.lessonId));
    expect(shared).toHaveLength(0);

    const clean = await boardsSideBySideCheck();
    expect(clean.status).toBe("ok");
  });

  it("the diagnostics flag a lesson on both boards, and a lesson from the wrong year", async () => {
    const eva = await child("eva", 7);
    const mikhael = await child("mikhael", 4);
    const y7 = await prisma.lesson.findFirstOrThrow({
      where: { unit: { programme: { yearGroup: 7, subject: { slug: "maths" } } } },
      include: { unit: { include: { programme: true } } },
    });
    const date = toDateOnly(schoolDayKey());
    for (const s of [eva, mikhael]) {
      await prisma.dailyAssignment.create({
        data: {
          studentId: s.id,
          date,
          kind: "LESSON",
          subjectId: y7.unit.programme.subjectId,
          lessonId: y7.id,
          estimatedMinutes: 45,
          order: 0,
          source: "AUTO",
        },
      });
    }

    const check = await boardsSideBySideCheck();
    expect(check.status).toBe("fail");
    expect(check.detail).toContain("the very same lesson row");
    expect(check.detail).toContain("YEAR 7 LESSON FOR A YEAR 4 CHILD");
  });
});
