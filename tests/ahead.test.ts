import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { TOPICS_PER_PERIOD, lessonsNeededAhead } from "@/lib/curriculum/ahead";

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
    /**
     * Two a week for two weeks, times the topics a period can get through.
     *
     * A period is no longer one lesson: finish a topic with time left and the next one starts
     * inside the same period. So the fortnight's buffer is the frequency times the weeks times
     * `TOPICS_PER_PERIOD`, and expressing it that way rather than as a number means this test
     * says the rule instead of restating an arithmetic result that moves.
     */
    const wanted = 2 * 2 * TOPICS_PER_PERIOD;
    // l1 is already teachable, so everything after it up to the buffer is wanted.
    expect(targets[0].lessonSlugs).toEqual(["l2", "l3", "l4", "l5", "l6"].slice(0, wanted - 1));
    // Six lessons exist; nothing to go looking for while the buffer fits inside them.
    expect(targets[0].discover).toBe(Math.max(0, wanted - 6));
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

    // Starting from where they actually are — not from lesson one.
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
    // One lesson exists and the fortnight's periods are coming: the rest have to be found.
    expect(targets[0].discover).toBe(3 * 2 * TOPICS_PER_PERIOD - 1);
    expect(targets[0].lessonSlugs).toEqual([]);
  });

  it("asks for nothing when the fortnight ahead is already teachable", async () => {
    /**
     * Enough ready lessons to cover the whole buffer, and one unready behind it.
     *
     * The buffer is the frequency times the weeks times the topics a period can cover, so it is
     * built from the constant rather than from a number — the point of the test is "nothing is
     * asked for once the fortnight is teachable", not any particular arithmetic.
     */
    const buffer = 1 * 2 * TOPICS_PER_PERIOD;
    await buildStudent({
      username: "ready",
      weeklyFrequency: 1,
      lessons: [
        ...Array.from({ length: buffer }, (_, i) => ({ slug: `l${i + 1}`, ready: true })),
        { slug: `l${buffer + 1}`, ready: false },
      ],
    });

    // The one behind the buffer can wait — importing it now is quota spent early, not saved.
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
