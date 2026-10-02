import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { lessonsNeededAhead } from "@/lib/curriculum/ahead";

/**
 * The importer and the planner have to agree about what "done" means.
 *
 * They did not. The planner counts a lesson finished below seventy per cent (NEEDS_REVIEW) or
 * placed out of (ALREADY_KNOWN) as behind the child; the importer asked only for COMPLETED and
 * MASTERED. The effect was an understated shortfall — the importer thought four lessons were
 * still ahead of her when the planner had already used them — plus a handful of wasted provider
 * requests re-fetching lessons by name that were already there.
 *
 * Not enough on its own to empty a day, so it is not being claimed as the cause of Eva's
 * missing English; it is two halves of one system disagreeing about the same question, which is
 * worth closing whether or not it was the thing that bit.
 */
async function childWhoHasBeenThroughEverything(status: "COMPLETED" | "NEEDS_REVIEW" | "ALREADY_KNOWN") {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: `s${Math.random().toString(36).slice(2, 8)}`, passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3", lessonsPerDay: 5, lessonMinutes: 45 },
  });
  const subject = await prisma.subject.create({
    data: { provider: "oak", slug: "english", title: "English" },
  });
  const programme = await prisma.programme.create({
    data: {
      provider: "oak",
      providerSlug: "english:7",
      subjectId: subject.id,
      yearGroup: 7,
      keyStage: "ks3",
      title: "English",
    },
  });
  const unit = await prisma.unit.create({
    data: { provider: "oak", providerSlug: "u1", programmeId: programme.id, title: "U", order: 1 },
  });

  // Four lessons, all of them behind her, all fully imported.
  for (let i = 1; i <= 4; i++) {
    const lesson = await prisma.lesson.create({
      data: {
        provider: "oak",
        providerSlug: `eng-l${i}`,
        unitId: unit.id,
        title: `English ${i}`,
        order: i,
        assetsSyncedAt: new Date(),
      },
    });
    await prisma.question.create({
      data: {
        lessonId: lesson.id,
        source: "OAK_EXIT_QUIZ",
        stage: "CHECK",
        order: 1,
        type: "TRUE_FALSE",
        prompt: "q",
        options: {},
        answerKey: { value: true },
        maxScore: 1,
        gradingMode: "DETERMINISTIC",
        providerRef: `eng-l${i}-q1`,
      },
    });
    await prisma.studentLessonProgress.create({
      data: { studentId: student.id, lessonId: lesson.id, status, completedAt: new Date() },
    });
  }

  await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: programme.id } });
  await prisma.studentSchedule.create({
    data: { studentId: student.id, subjectId: subject.id, weeklyFrequency: 5, priority: 4 },
  });
  return { studentId: student.id };
}

describe("what the next fortnight needs importing", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it.each(["COMPLETED", "NEEDS_REVIEW", "ALREADY_KNOWN"] as const)(
    "knows a %s lesson is behind them and asks for more",
    async (status) => {
      await childWhoHasBeenThroughEverything(status);

      const targets = await lessonsNeededAhead(2);
      const english = targets.find((t) => t.subjectSlug === "english");

      // Every lesson in the programme is behind her, so the fortnight needs new ones found.
      expect(english).toBeDefined();
      expect(english!.discover).toBeGreaterThan(0);
    },
  );

  it("asks for enough to survive a child covering two topics in a period", async () => {
    await childWhoHasBeenThroughEverything("COMPLETED");

    const targets = await lessonsNeededAhead(2);
    const english = targets.find((t) => t.subjectSlug === "english")!;

    // Five a week for two weeks used to mean ten. A period that carries on into the next topic
    // gets through more than one, so the buffer has to as well — otherwise the subject runs dry
    // mid-week, which is exactly what happened.
    expect(english.discover).toBeGreaterThanOrEqual(20);
  });
});
