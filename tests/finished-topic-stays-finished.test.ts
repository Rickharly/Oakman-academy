import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { completeStage, startOrResumeAttempt, submitStage } from "@/lib/lessons/service";
import { fixYearGroupEnrolments } from "@/lib/admin/enrol";

vi.mock("@/lib/curriculum/sync", async (orig) => ({
  ...(await orig<typeof import("@/lib/curriculum/sync")>()),
  syncProgramme: vi.fn(async () => ({ lessons: 0 })),
}));
vi.mock("@/lib/curriculum/generate", async (orig) => ({
  ...(await orig<typeof import("@/lib/curriculum/generate")>()),
  generateLessons: vi.fn(async () => []),
}));

async function child(yearGroup = 4) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: `m${Math.random()}`, passwordHash: "x", displayName: "Mikhael" },
  });
  return prisma.studentProfile.create({ data: { userId: user.id, yearGroup, keyStage: "ks2" } });
}

async function programme(slug: string, yearGroup: number, provider = "oak") {
  const subject =
    (await prisma.subject.findFirst({ where: { slug } })) ??
    (await prisma.subject.create({ data: { provider, slug, title: slug } }));
  const p = await prisma.programme.create({
    data: { provider, providerSlug: `${slug}:${yearGroup}`, subjectId: subject.id, yearGroup, keyStage: "ks2", title: `${slug} ${yearGroup}` },
  });
  const unit = await prisma.unit.create({ data: { provider, providerSlug: `${slug}-${yearGroup}-u`, programmeId: p.id, title: "U", order: 1 } });
  const lesson = await prisma.lesson.create({
    data: { provider, providerSlug: `${slug}-${yearGroup}-l`, unitId: unit.id, title: `${slug} year ${yearGroup}`, order: 1 },
  });
  return { programme: p, lesson, subject };
}

describe("a topic finished today stays finished", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("reopening it shows the finished attempt — never question one with the clock at zero", async () => {
    const student = await child();
    const { lesson } = await programme("maths", 4);
    const first = await startOrResumeAttempt(student.id, lesson.id);
    await prisma.lessonAttempt.update({ where: { id: first.id }, data: { currentStage: "CHECK", timeSpentSeconds: 600 } });
    await submitStage(first.id, student.id, "CHECK");
    await completeStage(first.id, student.id, "FEEDBACK");
    await completeStage(first.id, student.id, "COMPLETE");

    const again = await startOrResumeAttempt(student.id, lesson.id);
    expect(again.id).toBe(first.id);
    expect(again.currentStage).toBe("COMPLETE");
    expect(await prisma.lessonAttempt.count({ where: { studentId: student.id, lessonId: lesson.id } })).toBe(1);
  });
});

describe("moving a child up a year", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("moves each subject as soon as its new-year lessons exist, without waiting for the others", async () => {
    const student = await child(4);
    const maths4 = await programme("maths", 4);
    const writing4 = await programme("writing", 4, "oakman");
    const maths5 = await programme("maths", 5);
    for (const p of [maths4, writing4]) {
      await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: p.programme.id } });
    }
    await prisma.studentProfile.update({ where: { id: student.id }, data: { yearGroup: 5 } });

    await fixYearGroupEnrolments(student.id);

    const active = await prisma.studentEnrolment.findMany({
      where: { studentId: student.id, active: true },
      include: { programme: { include: { subject: true } } },
    });
    const by = Object.fromEntries(active.map((e) => [e.programme.subject.slug, e.programme.yearGroup]));
    expect(by.maths).toBe(5); // moved
    expect(by.writing).toBe(4); // waits for its Year 5 lessons to be written
    expect(active.some((e) => e.programmeId === maths5.programme.id)).toBe(true);
  });
});
