import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { applyOverride, effectiveGrade } from "@/lib/admin/overrides";

describe("admin overrides", () => {
  let parentId: string;
  let studentId: string;
  let lessonId: string;
  let lessonAttemptId: string;
  let activityAttemptId: string;
  let q1Id: string;
  let q2Id: string;
  let q3Id: string;
  let qa1Id: string;

  beforeAll(async () => {
    await resetDb();

    const parentUser = await prisma.user.create({
      data: { role: "PARENT", email: "parent@example.com", passwordHash: "x", displayName: "Parent" },
    });
    parentId = parentUser.id;

    const studentUser = await prisma.user.create({
      data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
    });
    await prisma.parentStudentLink.create({ data: { parentId, studentId: studentUser.id } });
    const student = await prisma.studentProfile.create({
      data: { userId: studentUser.id, yearGroup: 7, keyStage: "ks3" },
    });
    studentId = student.id;

    const subject = await prisma.subject.create({ data: { slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: { providerSlug: "test-maths:7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths — Year 7" },
    });
    const unit = await prisma.unit.create({
      data: { providerSlug: "fractions", programmeId: programme.id, title: "Fractions", order: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: { providerSlug: "adding-fractions", unitId: unit.id, title: "Adding fractions", order: 1, estimatedMinutes: 50 },
    });
    lessonId = lesson.id;

    const makeQuestion = (order: number) =>
      prisma.question.create({
        data: {
          lessonId,
          source: "OAK_EXIT_QUIZ",
          stage: "CHECK",
          order,
          type: "MULTIPLE_CHOICE",
          prompt: `Question ${order}`,
          options: { choices: [{ id: "a", text: "Correct" }, { id: "b", text: "Wrong" }] },
          answerKey: { correctOptionId: "a" },
          maxScore: 1,
        },
      });
    const q1 = await makeQuestion(1);
    const q2 = await makeQuestion(2);
    const q3 = await makeQuestion(3);
    q1Id = q1.id;
    q2Id = q2.id;
    q3Id = q3.id;

    const lessonAttempt = await prisma.lessonAttempt.create({
      data: {
        studentId,
        lessonId,
        attemptNumber: 1,
        status: "COMPLETED",
        currentStage: "COMPLETE",
        assessmentCompletedAt: new Date(),
        completedAt: new Date(),
      },
    });
    lessonAttemptId = lessonAttempt.id;

    const activity = await prisma.activityAttempt.create({
      data: {
        lessonAttemptId,
        stage: "CHECK",
        attemptNumber: 1,
        status: "GRADED",
        submittedAt: new Date(),
        gradedAt: new Date(),
        score: 1,
        maxScore: 3,
        percentage: (1 / 3) * 100,
      },
    });
    activityAttemptId = activity.id;

    // Q1: answered incorrectly (score 0). Q2: correct (score 1). Q3: incorrect (score 0).
    const qa1 = await prisma.questionAttempt.create({
      data: {
        activityAttemptId,
        questionId: q1Id,
        studentId,
        attemptNumber: 1,
        response: { optionId: "b" },
        gradedBy: "DETERMINISTIC",
        gradedAt: new Date(),
        isCorrect: false,
        score: 0,
        maxScore: 1,
      },
    });
    qa1Id = qa1.id;
    await prisma.questionAttempt.create({
      data: {
        activityAttemptId,
        questionId: q2Id,
        studentId,
        attemptNumber: 1,
        response: { optionId: "a" },
        gradedBy: "DETERMINISTIC",
        gradedAt: new Date(),
        isCorrect: true,
        score: 1,
        maxScore: 1,
      },
    });
    await prisma.questionAttempt.create({
      data: {
        activityAttemptId,
        questionId: q3Id,
        studentId,
        attemptNumber: 1,
        response: { optionId: "b" },
        gradedBy: "DETERMINISTIC",
        gradedAt: new Date(),
        isCorrect: false,
        score: 0,
        maxScore: 1,
      },
    });

    await prisma.lessonAttempt.update({ where: { id: lessonAttemptId }, data: { masteryScore: 1 / 3, score: 1, maxScore: 3 } });
  });

  it("MARK_CORRECT leaves the QuestionAttempt untouched and records the override + previous value", async () => {
    const override = await applyOverride(parentId, {
      studentId,
      type: "MARK_CORRECT",
      questionAttemptId: qa1Id,
      questionId: q1Id,
    });

    expect(override.type).toBe("MARK_CORRECT");
    expect(override.previousValue).toMatchObject({ score: 0, isCorrect: false, maxScore: 1 });
    expect(override.newValue).toMatchObject({ score: 1, isCorrect: true });

    // The machine's own record is immutable.
    const qa1 = await prisma.questionAttempt.findUniqueOrThrow({ where: { id: qa1Id } });
    expect(qa1.score).toBe(0);
    expect(qa1.isCorrect).toBe(false);
    expect(qa1.gradedBy).toBe("DETERMINISTIC");

    // The effective grade — what the inspection view and rollups use — reflects the override.
    const effective = effectiveGrade(qa1, [override]);
    expect(effective.overridden).toBe(true);
    expect(effective.score).toBe(1);
    expect(effective.isCorrect).toBe(true);

    // Rollups recomputed: 3/3 questions now effectively correct = 100%... wait, only q1 flipped:
    // q1 (overridden) 1/1 + q2 1/1 + q3 0/1 = 2/3.
    const activity = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: activityAttemptId } });
    expect(activity.score).toBeCloseTo(2, 5);
    expect(activity.maxScore).toBeCloseTo(3, 5);
    expect(activity.percentage).toBeCloseTo((2 / 3) * 100, 3);

    const lessonAttempt = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: lessonAttemptId } });
    expect(lessonAttempt.masteryScore).toBeCloseTo(2 / 3, 3);

    const progress = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    expect(progress.bestScorePct).toBeCloseTo((2 / 3) * 100, 3);
    expect(progress.mastery).toBeCloseTo(2 / 3, 3);

    const masteryRecords = await prisma.masteryRecord.findMany({ where: { studentId, lessonId, reason: "parent_override" } });
    expect(masteryRecords.length).toBeGreaterThan(0);
  });

  it("EXCLUDE_QUESTION recomputes the percentage without touching history", async () => {
    const override = await applyOverride(parentId, { studentId, type: "EXCLUDE_QUESTION", questionId: q3Id });
    expect(override.type).toBe("EXCLUDE_QUESTION");
    expect(override.previousValue).toMatchObject({ excluded: false });
    expect(override.newValue).toMatchObject({ excluded: true });

    const question = await prisma.question.findUniqueOrThrow({ where: { id: q3Id } });
    expect(question.excluded).toBe(true);

    // Q1 (overridden correct) 1/1 + Q2 1/1 = 2/2 = 100%, Q3 no longer counted at all.
    const activity = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: activityAttemptId } });
    expect(activity.maxScore).toBeCloseTo(2, 5);
    expect(activity.score).toBeCloseTo(2, 5);
    expect(activity.percentage).toBeCloseTo(100, 3);

    // The excluded QuestionAttempt itself is still there, unchanged — nothing is ever deleted.
    const qa3 = await prisma.questionAttempt.findFirstOrThrow({ where: { activityAttemptId, questionId: q3Id } });
    expect(qa3.score).toBe(0);
    expect(qa3.isCorrect).toBe(false);
  });
});
