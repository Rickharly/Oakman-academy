import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { getAttemptView, startOrResumeAttempt, visibleQuestionsForLesson } from "@/lib/lessons/service";
import { recordPreCheckCorrect } from "@/lib/questions/seen";
import { ensureFreshCheckQuestions, freshCheckShortfall } from "@/lib/lessons/fresh-questions";

/**
 * "My son said that he's getting the same questions again."
 *
 * A question a child has already answered correctly — in an earlier attempt, a pre-check, or
 * under another lesson with the same wording — is not put in front of them again. One they
 * got wrong is: that is how they learn it.
 */
async function setup() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "mikhael", passwordHash: "x", displayName: "Mikhael" },
  });
  const student = await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 4, keyStage: "ks2" } });
  const subject = await prisma.subject.create({ data: { provider: "oak", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "oak", providerSlug: "maths:4", subjectId: subject.id, yearGroup: 4, keyStage: "ks2", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "oak", providerSlug: "u1", programmeId: programme.id, title: "Fractions", order: 1 },
  });
  const lesson = async (slug: string, order: number) =>
    prisma.lesson.create({ data: { provider: "oak", providerSlug: slug, unitId: unit.id, title: `Lesson ${slug}`, order } });
  return { studentId: student.id, lesson };
}

async function question(
  lessonId: string,
  stage: "STARTER" | "CHECK" | "PRACTICE",
  prompt: string,
  order: number,
  extra: Partial<{ source: "OAK_EXIT_QUIZ" | "OAK_STARTER_QUIZ" | "AI_GENERATED"; generatedForStudentId: string | null }> = {},
) {
  return prisma.question.create({
    data: {
      lessonId,
      source: extra.source ?? (stage === "STARTER" ? "OAK_STARTER_QUIZ" : "OAK_EXIT_QUIZ"),
      generatedForStudentId: extra.generatedForStudentId ?? null,
      stage,
      order,
      type: "MULTIPLE_CHOICE",
      prompt,
      options: { choices: [{ id: "a", text: "Right" }, { id: "b", text: "Wrong" }] },
      answerKey: { correctOptionId: "a" },
      maxScore: 1,
      gradingMode: "DETERMINISTIC",
    },
  });
}

/** An earlier, finished attempt in which they answered these, right or wrong. */
async function answeredBefore(studentId: string, lessonId: string, answers: { id: string; right: boolean }[]) {
  const prior = await prisma.lessonAttempt.count({ where: { studentId, lessonId } });
  const attempt = await prisma.lessonAttempt.create({
    data: {
      studentId,
      lessonId,
      attemptNumber: prior + 1,
      status: "COMPLETED",
      currentStage: "COMPLETE",
      startedAt: new Date(Date.now() - 2 * 86_400_000),
      completedAt: new Date(Date.now() - 86_400_000),
    },
  });
  const activity = await prisma.activityAttempt.create({
    data: { lessonAttemptId: attempt.id, stage: "CHECK", attemptNumber: 1, status: "GRADED" },
  });
  for (const a of answers) {
    await prisma.questionAttempt.create({
      data: {
        activityAttemptId: activity.id,
        questionId: a.id,
        studentId,
        attemptNumber: 1,
        response: { optionId: a.right ? "a" : "b" },
        gradedBy: "DETERMINISTIC",
        isCorrect: a.right,
        score: a.right ? 1 : 0,
        maxScore: 1,
        submittedAt: new Date(Date.now() - 2 * 86_400_000),
      },
    });
  }
}

const ids = (qs: { id: string }[]) => qs.map((q) => q.id);

describe("never the same question twice", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("a lesson opened again leaves out the quiz questions they got right, and keeps the wrong ones", async () => {
    const { studentId, lesson } = await setup();
    const l = await lesson("a", 1);
    const qs = [];
    for (let i = 0; i < 6; i += 1) qs.push(await question(l.id, "CHECK", `Exit question number ${i}`, i));
    await answeredBefore(studentId, l.id, [
      { id: qs[0].id, right: true },
      { id: qs[1].id, right: true },
      { id: qs[2].id, right: false },
    ]);

    const attempt = await startOrResumeAttempt(studentId, l.id);
    const view = await getAttemptView(attempt.id, studentId);
    expect(ids(view.questionsByStage.CHECK)).toEqual(ids(qs.slice(2)));
  });

  it("Oak's starter that repeats the last lesson's exit quiz word for word is skipped", async () => {
    const { studentId, lesson } = await setup();
    const one = await lesson("one", 1);
    const two = await lesson("two", 2);
    const exit = await question(one.id, "CHECK", "What fraction of the shape is shaded?", 1);
    await question(two.id, "STARTER", "What fraction of the shape is shaded?", 1);
    const fresh = await question(two.id, "STARTER", "Which is bigger, 1/3 or 1/4?", 2);
    await answeredBefore(studentId, one.id, [{ id: exit.id, right: true }]);

    const attempt = await startOrResumeAttempt(studentId, two.id);
    const view = await getAttemptView(attempt.id, studentId);
    expect(ids(view.questionsByStage.STARTER)).toEqual([fresh.id]);
  });

  it("what they got right in the pre-check is not asked again at the end of the lesson", async () => {
    const { studentId, lesson } = await setup();
    const l = await lesson("a", 1);
    const qs = [];
    for (let i = 0; i < 6; i += 1) qs.push(await question(l.id, "CHECK", `Exit question number ${i}`, i));
    await startOrResumeAttempt(studentId, l.id);

    await recordPreCheckCorrect(studentId, l.id, [qs[0].id, qs[1].id]);

    const { questions } = await visibleQuestionsForLesson(studentId, l.id, "CHECK");
    expect(ids(questions)).toEqual(ids(qs.slice(2)));
  });

  it("the end-of-lesson quiz never shrinks below three", async () => {
    const { studentId, lesson } = await setup();
    const l = await lesson("a", 1);
    const qs = [];
    for (let i = 0; i < 4; i += 1) qs.push(await question(l.id, "CHECK", `Exit question number ${i}`, i));
    await answeredBefore(studentId, l.id, qs.map((q) => ({ id: q.id, right: true })));

    const attempt = await startOrResumeAttempt(studentId, l.id);
    const view = await getAttemptView(attempt.id, studentId);
    expect(view.questionsByStage.CHECK).toHaveLength(3);
  });

  it("writes new quiz questions in their place, used from the next attempt that starts", async () => {
    const { studentId, lesson } = await setup();
    const l = await lesson("a", 1);
    const qs = [];
    for (let i = 0; i < 4; i += 1) qs.push(await question(l.id, "CHECK", `Exit question number ${i}`, i));
    await answeredBefore(studentId, l.id, qs.map((q) => ({ id: q.id, right: true })));

    expect(await freshCheckShortfall(studentId, l.id)).toBe(4);
    const written = await ensureFreshCheckQuestions(studentId, l.id);
    expect(written).toBeGreaterThan(0);
    expect(await freshCheckShortfall(studentId, l.id)).toBe(4 - written);

    const attempt = await startOrResumeAttempt(studentId, l.id);
    const view = await getAttemptView(attempt.id, studentId);
    const shown = await prisma.question.findMany({ where: { id: { in: ids(view.questionsByStage.CHECK) } } });
    // The new ones are on the quiz, and every one of them is new to this child.
    expect(shown.filter((q) => q.source === "AI_GENERATED")).toHaveLength(written);
    expect(shown.every((q) => q.source === "AI_GENERATED")).toBe(written >= 3);
  });

  it("new quiz questions written after an attempt started are kept for the next one", async () => {
    const { studentId, lesson } = await setup();
    const l = await lesson("a", 1);
    for (let i = 0; i < 3; i += 1) await question(l.id, "CHECK", `Exit question number ${i}`, i);
    const attempt = await startOrResumeAttempt(studentId, l.id);
    const late = await question(l.id, "CHECK", "A brand new question written mid-lesson", 9, {
      source: "AI_GENERATED",
      generatedForStudentId: studentId,
    });

    const view = await getAttemptView(attempt.id, studentId);
    expect(ids(view.questionsByStage.CHECK)).not.toContain(late.id);
  });

  it("a quiz written for a lesson nobody else provides (Writing, Logic) is visible", async () => {
    const { studentId, lesson } = await setup();
    const l = await lesson("w", 1);
    const shared = await question(l.id, "CHECK", "Which sentence uses a fronted adverbial?", 1, {
      source: "AI_GENERATED",
      generatedForStudentId: null,
    });

    const attempt = await startOrResumeAttempt(studentId, l.id);
    const view = await getAttemptView(attempt.id, studentId);
    expect(ids(view.questionsByStage.CHECK)).toEqual([shared.id]);
  });
});
