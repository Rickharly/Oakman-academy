import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { generateReport } from "@/lib/reports/generate";
import { schoolDayKey, weekStartKey } from "@/lib/dates";
import type { ReportData } from "@/lib/reports/generate";

describe("reports", () => {
  let studentId: string;
  let lessonId: string;
  let weekStart: string;

  beforeAll(async () => {
    await resetDb();

    const studentUser = await prisma.user.create({
      data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
    });
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

    weekStart = weekStartKey(schoolDayKey());
    const now = new Date();

    const lessonAttempt = await prisma.lessonAttempt.create({
      data: {
        studentId,
        lessonId,
        attemptNumber: 1,
        status: "COMPLETED",
        currentStage: "COMPLETE",
        completedAt: now,
        timeSpentSeconds: 1200,
        masteryScore: 0.8,
      },
    });

    const activity = await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: lessonAttempt.id,
        stage: "CHECK",
        attemptNumber: 1,
        status: "GRADED",
        submittedAt: now,
        gradedAt: now,
        score: 4,
        maxScore: 5,
        percentage: 80,
      },
    });

    const question = await prisma.question.create({
      data: {
        lessonId,
        source: "OAK_EXIT_QUIZ",
        stage: "CHECK",
        order: 1,
        type: "MULTIPLE_CHOICE",
        prompt: "1/2 + 1/2 = ?",
        options: { choices: [{ id: "a", text: "1" }, { id: "b", text: "2" }] },
        answerKey: { correctOptionId: "a" },
        maxScore: 5,
      },
    });

    await prisma.questionAttempt.create({
      data: {
        activityAttemptId: activity.id,
        questionId: question.id,
        studentId,
        attemptNumber: 1,
        response: { optionId: "a" },
        gradedBy: "DETERMINISTIC",
        gradedAt: now,
        isCorrect: true,
        score: 4,
        maxScore: 5,
      },
    });

    await prisma.masteryRecord.create({
      data: { studentId, lessonId, mastery: 0.8, previousMastery: 0.5, reason: "check_quiz", sourceId: activity.id },
    });

    await prisma.reviewItem.create({
      data: {
        studentId,
        lessonId,
        reason: "LOW_SCORE",
        status: "DONE",
        dueAt: now,
        completedAt: now,
        outcomeScorePct: 90,
      },
    });
  });

  it("computes stats from the learning tables and still saves when the AI summary is unavailable", async () => {
    const report = await generateReport(studentId, "WEEKLY", weekStart);

    expect(report.studentId).toBe(studentId);
    expect(report.period).toBe("WEEKLY");

    const data = report.data as unknown as ReportData;
    expect(data.lessonsCompleted).toBe(1);
    expect(data.studyTimeMinutes).toBe(20);
    expect(data.averageAssessmentPct).toBeCloseTo(80, 3);
    expect(data.strongestSubject?.subjectTitle).toBe("Maths");
    expect(data.masteryMovement).toBeCloseTo(0.3, 3);
    expect(data.reviewOutcomes).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: "LOW_SCORE", count: 1, averageScorePct: 90 })])
    );

    // The mock AI provider has no fixture for "reportSummary", so this must fail closed:
    // the stats are still saved, just without a teacher summary.
    expect(report.teacherSummary).toBeNull();

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.data).toBeTruthy();
  });
});
