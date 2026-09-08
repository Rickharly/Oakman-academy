import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { lessonsNeededAhead } from "@/lib/curriculum/ahead";

/**
 * What the weekly import decides to fetch.
 *
 * Getting this wrong is expensive in both directions: fetch too much and a quota window goes on
 * material nobody opens for a month; fetch the wrong ones and a child opens Tuesday's lesson to
 * an empty page. So the rule is exact — the next `weeklyFrequency × weeks` lessons in the
 * programme's sequence that this child has not finished, minus the ones already teachable.
 */
async function buildStudent(opts: {
  username: string;
  weeklyFrequency: number;
  lessons: { slug: string; ready: boolean }[];
}) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: opts.username, passwordHash: "x", displayName: opts.username },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: {
      provider: "test",
      providerSlug: "maths:7",
      subjectId: subject.id,
      yearGroup: 7,
      keyStage: "ks3",
      title: "Maths",
    },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: "maths-u1", programmeId: programme.id, title: "Unit", order: 1 },
  });

  const lessons = [];
  for (const [i, spec] of opts.lessons.entries()) {
    const lesson = await prisma.lesson.create({
      data: {
        provider: "test",
        providerSlug: spec.slug,
        unitId: unit.id,
        title: spec.slug,
        order: i + 1,
        // Ready means: we have read its assets, and it has questions to answer.
        assetsSyncedAt: spec.ready ? new Date() : null,
      },
    });
    if (spec.ready) {
      await prisma.question.create({
        data: {
          lessonId: lesson.id,
          source: "OAK_EXIT_QUIZ",
          stage: "CHECK",
          order: 1,
          type: "SHORT_ANSWER",
          prompt: "q",
          answerKey: { accepted: ["a"], caseSensitive: false },
        },
      });
    }
    lessons.push(lesson);
  }

  await prisma.studentEnrolment.create({ data: { studentId: profile.id, programmeId: programme.id } });
  await prisma.studentSchedule.create({
    data: { studentId: profile.id, subjectId: subject.id, weeklyFrequency: opts.weeklyFrequency, priority: 1 },
  });

  return { studentId: profile.id, lessons };
}

describe("the lessons the next fortnight needs", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("asks for the next lessons in sequence, and only the ones not ready", async () => {
    await buildStudent({
      username: "eva",
      weeklyFrequency: 2,
      lessons: [
        { slug: "l1", ready: true },
        { slug: "l2", ready: false },
        { slug: "l3", ready: false },
        { slug: "l4", ready: false },
        { slug: "l5", ready: false },
        { slug: "l6", ready: false },
      ],
    });

    const targets = await lessonsNeededAhead(2);

    expect(targets).toHaveLength(1);
    expect(targets[0].subjectSlug).toBe("maths");
    expect(targets[0].yearGroup).toBe(7);
    // Two a week for two weeks is four lessons; l1 is already teachable, so three are wanted.
    expect(targets[0].lessonSlugs).toEqual(["l2", "l3", "l4"]);
    // Six lessons exist and four are needed — nothing to go looking for.
    expect(targets[0].discover).toBe(0);
    // And it knows which unit to read, so it does not walk the whole year to find them.
    expect(targets[0].unitSlugs).toEqual(["maths-u1"]);
  });

  it("skips past lessons the child has already finished", async () => {
    const { studentId, lessons } = await buildStudent({
      username: "mikhael",
      weeklyFrequency: 1,
      lessons: [
        { slug: "l1", ready: false },
        { slug: "l2", ready: false },
        { slug: "l3", ready: false },
      ],
    });
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: lessons[0].id, status: "COMPLETED" },
    });

    const targets = await lessonsNeededAhead(2);

    // One a week for two weeks, starting from where they actually are — not from lesson one.
    expect(targets[0].lessonSlugs).toEqual(["l2", "l3"]);
  });

  it("goes looking for more when a subject has run out of lessons entirely", async () => {
    // This is why a child ends up with two English periods and no history. Asking for lessons
    // by name can only return lessons we already have, so a subject with nothing imported was
    // invisible to the weekly import — and the planner filled its periods from somewhere else.
    await buildStudent({
      username: "starved",
      weeklyFrequency: 3,
      lessons: [{ slug: "l1", ready: true }],
    });

    const targets = await lessonsNeededAhead(2);

    expect(targets).toHaveLength(1);
    // One lesson exists and six periods are coming: five have to be found.
    expect(targets[0].discover).toBe(5);
    expect(targets[0].lessonSlugs).toEqual([]);
  });

  it("asks for nothing when the fortnight ahead is already teachable", async () => {
    await buildStudent({
      username: "ready",
      weeklyFrequency: 1,
      lessons: [
        { slug: "l1", ready: true },
        { slug: "l2", ready: true },
        { slug: "l3", ready: false },
      ],
    });

    // One a week for two weeks reaches l1 and l2, both of which are teachable, and a third
    // exists behind them. l3 can wait — importing it now is quota spent early, not saved.
    expect(await lessonsNeededAhead(2)).toEqual([]);
  });

  it("counts a lesson with no questions as not ready, however its assets look", async () => {
    await buildStudent({
      username: "noquiz",
      weeklyFrequency: 1,
      lessons: [{ slug: "l1", ready: false }],
    });
    // Assets read, but nothing to answer: this is the shape a child meets as "here are some
    // bullet points, now take the test".
    await prisma.lesson.updateMany({ where: { providerSlug: "l1" }, data: { assetsSyncedAt: new Date() } });

    const targets = await lessonsNeededAhead(2);
    expect(targets[0].lessonSlugs).toEqual(["l1"]);
  });
});
