import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { POST } from "@/app/api/admin/students/[studentId]/remove/route";
import { resetDb } from "./helpers/db";

/**
 * Covers `POST /api/admin/students/[studentId]/remove` (src/lib/admin/remove.ts,
 * src/lib/auth/api.ts `requireParentForRemovalApi`): permanently deleting a student account.
 */

async function createParent(email = "parent@example.com") {
  return prisma.user.create({
    data: { role: "PARENT", email, passwordHash: "x", displayName: "Parent" },
  });
}

async function sessionFor(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: { tokenHash, userId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  return token;
}

async function createStudent(displayName: string, username: string, opts?: { yearGroup?: number }) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username, passwordHash: "x", displayName },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: opts?.yearGroup ?? 7, keyStage: "ks3" },
  });
  return { user, profile };
}

/** Curriculum fixtures + a rich set of learning rows for one student, so the counts returned by
 * removal can be checked against something non-trivial rather than all zeros. */
async function seedLearningHistory(parentId: string, studentId: string) {
  const subject = await prisma.subject.create({ data: { slug: `maths-${studentId}`, title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { providerSlug: `seq-${studentId}:7`, subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths — Year 7" },
  });
  const unit = await prisma.unit.create({
    data: { providerSlug: `unit-${studentId}`, programmeId: programme.id, title: "Fractions", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { providerSlug: `lesson-${studentId}`, unitId: unit.id, title: "Adding fractions", order: 1, estimatedMinutes: 45 },
  });
  const question = await prisma.question.create({
    data: {
      lessonId: lesson.id,
      source: "OAK_EXIT_QUIZ",
      stage: "CHECK",
      order: 1,
      type: "MULTIPLE_CHOICE",
      prompt: "1/2 + 1/2 = ?",
      options: { choices: [{ id: "a", text: "1" }, { id: "b", text: "2" }] },
      answerKey: { correctOptionId: "a" },
      maxScore: 1,
    },
  });
  const generatedQuestion = await prisma.question.create({
    data: {
      lessonId: lesson.id,
      source: "AI_GENERATED",
      stage: "PRACTICE",
      order: 2,
      type: "MULTIPLE_CHOICE",
      prompt: "Practice: 1/4 + 1/4 = ?",
      options: { choices: [{ id: "a", text: "1/2" }, { id: "b", text: "1" }] },
      answerKey: { correctOptionId: "a" },
      maxScore: 1,
      generatedForStudentId: studentId,
    },
  });

  const lessonAttempt = await prisma.lessonAttempt.create({
    data: { studentId, lessonId: lesson.id, attemptNumber: 1, status: "COMPLETED", currentStage: "COMPLETE" },
  });
  const activityAttempt = await prisma.activityAttempt.create({
    data: { lessonAttemptId: lessonAttempt.id, stage: "CHECK", attemptNumber: 1, status: "GRADED" },
  });
  await prisma.questionAttempt.create({
    data: {
      activityAttemptId: activityAttempt.id,
      questionId: question.id,
      studentId,
      attemptNumber: 1,
      response: { selectedOptionId: "a" },
      isCorrect: true,
      score: 1,
      maxScore: 1,
    },
  });
  await prisma.questionAttempt.create({
    data: {
      activityAttemptId: activityAttempt.id,
      questionId: generatedQuestion.id,
      studentId,
      attemptNumber: 1,
      response: { selectedOptionId: "a" },
      isCorrect: true,
      score: 1,
      maxScore: 1,
    },
  });

  const readingText = await prisma.readingText.create({
    data: { slug: `passage-${studentId}`, title: "A Story", yearGroup: 7, order: 1, body: "Once upon a time.", wordCount: 4 },
  });

  await prisma.$transaction([
    prisma.studentEnrolment.create({ data: { studentId, programmeId: programme.id } }),
    prisma.studentSchedule.create({ data: { studentId, subjectId: subject.id, weeklyFrequency: 5 } }),
    prisma.dailyAssignment.create({
      data: { studentId, date: new Date("2026-09-01"), order: 1, kind: "LESSON", source: "AUTO", lessonId: lesson.id },
    }),
    prisma.readingEntry.create({
      data: { studentId, readingTextId: readingText.id, prompt: "What happened?", response: "Something." },
    }),
    prisma.studentLessonProgress.create({
      data: { studentId, lessonId: lesson.id, status: "COMPLETED", attempts: 1 },
    }),
    prisma.masteryRecord.create({ data: { studentId, lessonId: lesson.id, mastery: 0.9, reason: "check_quiz" } }),
    prisma.reviewItem.create({
      data: { studentId, lessonId: lesson.id, reason: "LOW_SCORE", dueAt: new Date("2026-09-02") },
    }),
    prisma.aiConversation.create({ data: { studentId, lessonId: lesson.id, mode: "LEARN" } }),
    prisma.aiLearningObservation.create({
      data: { studentId, kind: "STRENGTH", topic: "fractions", detail: "Adds unit fractions confidently." },
    }),
    prisma.teacherFeedback.create({ data: { studentId, authorType: "AI", content: "Great work." } }),
    prisma.dailySummary.create({ data: { studentId, date: new Date("2026-09-01"), content: "Busy day." } }),
    prisma.parentOverride.create({
      data: { parentId, studentId, type: "COMMENT", comment: "Nice try." },
    }),
    prisma.report.create({
      data: {
        studentId,
        period: "WEEKLY",
        periodStart: new Date("2026-08-25"),
        periodEnd: new Date("2026-08-31"),
        data: {},
      },
    }),
    prisma.activityLog.create({ data: { studentId, kind: "login" } }),
    prisma.schoolDay.create({ data: { studentId, date: new Date("2026-09-01"), plannedStartTime: "13:00" } }),
    prisma.focusEvent.create({ data: { studentId, date: new Date("2026-09-01"), kind: "DRINK" } }),
    prisma.understandingGap.create({
      data: { studentId, lessonId: lesson.id, concept: "denominators", misunderstanding: "Adds them directly." },
    }),
  ]);

  return { subject, programme, unit, lesson, question, generatedQuestion, readingText };
}

function removeRequest(token: string, body: unknown) {
  return new Request("http://localhost/api/admin/students/x/remove", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE}=${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctxFor(studentId: string) {
  return { params: Promise.resolve({ studentId }) };
}

describe("POST /api/admin/students/[studentId]/remove", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("removes a linked student: User, StudentProfile and dependent rows are gone, and counts match what existed", async () => {
    const parent = await createParent();
    const token = await sessionFor(parent.id);
    const { user: studentUser, profile } = await createStudent("Rich", "rich");
    await prisma.parentStudentLink.create({ data: { parentId: parent.id, studentId: studentUser.id } });
    await seedLearningHistory(parent.id, profile.id);

    const [
      lessonAttemptsBefore,
      questionAttemptsBefore,
      assignmentsBefore,
      readingEntriesBefore,
      enrolmentsBefore,
      schedulesBefore,
      progressBefore,
      masteryBefore,
      reviewBefore,
      conversationsBefore,
      observationsBefore,
      feedbackBefore,
      overridesBefore,
      dailySummariesBefore,
      reportsBefore,
      activityLogsBefore,
      schoolDaysBefore,
      focusEventsBefore,
      understandingGapsBefore,
    ] = await Promise.all([
      prisma.lessonAttempt.count({ where: { studentId: profile.id } }),
      prisma.questionAttempt.count({ where: { studentId: profile.id } }),
      prisma.dailyAssignment.count({ where: { studentId: profile.id } }),
      prisma.readingEntry.count({ where: { studentId: profile.id } }),
      prisma.studentEnrolment.count({ where: { studentId: profile.id } }),
      prisma.studentSchedule.count({ where: { studentId: profile.id } }),
      prisma.studentLessonProgress.count({ where: { studentId: profile.id } }),
      prisma.masteryRecord.count({ where: { studentId: profile.id } }),
      prisma.reviewItem.count({ where: { studentId: profile.id } }),
      prisma.aiConversation.count({ where: { studentId: profile.id } }),
      prisma.aiLearningObservation.count({ where: { studentId: profile.id } }),
      prisma.teacherFeedback.count({ where: { studentId: profile.id } }),
      prisma.parentOverride.count({ where: { studentId: profile.id } }),
      prisma.dailySummary.count({ where: { studentId: profile.id } }),
      prisma.report.count({ where: { studentId: profile.id } }),
      prisma.activityLog.count({ where: { studentId: profile.id } }),
      prisma.schoolDay.count({ where: { studentId: profile.id } }),
      prisma.focusEvent.count({ where: { studentId: profile.id } }),
      prisma.understandingGap.count({ where: { studentId: profile.id } }),
    ]);
    expect(lessonAttemptsBefore).toBe(1);
    expect(questionAttemptsBefore).toBe(2);

    const res = await POST(removeRequest(token, { confirm: "rich" }), ctxFor(profile.id));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.displayName).toBe("Rich");
    expect(body.lessonAttempts).toBe(lessonAttemptsBefore);
    expect(body.questionAttempts).toBe(questionAttemptsBefore);
    expect(body.assignments).toBe(assignmentsBefore);
    expect(body.readingEntries).toBe(readingEntriesBefore);
    expect(body.enrolments).toBe(enrolmentsBefore);
    expect(body.schedules).toBe(schedulesBefore);
    expect(body.progress).toBe(progressBefore);
    expect(body.masteryRecords).toBe(masteryBefore);
    expect(body.reviewItems).toBe(reviewBefore);
    expect(body.conversations).toBe(conversationsBefore);
    expect(body.observations).toBe(observationsBefore);
    expect(body.feedback).toBe(feedbackBefore);
    expect(body.overrides).toBe(overridesBefore);
    expect(body.dailySummaries).toBe(dailySummariesBefore);
    expect(body.reports).toBe(reportsBefore);
    expect(body.activityLogs).toBe(activityLogsBefore);
    expect(body.schoolDays).toBe(schoolDaysBefore);
    expect(body.focusEvents).toBe(focusEventsBefore);
    expect(body.understandingGaps).toBe(understandingGapsBefore);
    expect(body.generatedQuestions).toBe(1);

    // The account itself, and everything under it, is gone.
    expect(await prisma.user.findUnique({ where: { id: studentUser.id } })).toBeNull();
    expect(await prisma.studentProfile.findUnique({ where: { id: profile.id } })).toBeNull();
    expect(await prisma.parentStudentLink.count({ where: { studentId: studentUser.id } })).toBe(0);
    expect(await prisma.lessonAttempt.count({ where: { studentId: profile.id } })).toBe(0);
    expect(await prisma.questionAttempt.count({ where: { studentId: profile.id } })).toBe(0);
    expect(await prisma.dailyAssignment.count({ where: { studentId: profile.id } })).toBe(0);
    expect(await prisma.readingEntry.count({ where: { studentId: profile.id } })).toBe(0);
    expect(await prisma.reviewItem.count({ where: { studentId: profile.id } })).toBe(0);
    expect(await prisma.parentOverride.count({ where: { studentId: profile.id } })).toBe(0);
    expect(await prisma.report.count({ where: { studentId: profile.id } })).toBe(0);
    expect(await prisma.understandingGap.count({ where: { studentId: profile.id } })).toBe(0);

    // The AI-generated practice question written for this child is purged too (SetNull FK,
    // not a cascade — see src/lib/admin/remove.ts).
    const generated = await prisma.question.findMany({ where: { source: "AI_GENERATED", generatedForStudentId: profile.id } });
    expect(generated).toHaveLength(0);

    // The parent's own account is untouched.
    expect(await prisma.user.findUnique({ where: { id: parent.id } })).not.toBeNull();
  });

  it("removes an orphan student profile with no learning record (no parent links, never used) for any authenticated parent", async () => {
    const parent = await createParent("parent2@example.com");
    const token = await sessionFor(parent.id);
    const { user: orphanUser, profile } = await createStudent("Orphan Test", "orphan-test");
    // Deliberately no ParentStudentLink row.

    const res = await POST(removeRequest(token, { confirm: "Orphan Test" }), ctxFor(profile.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.displayName).toBe("Orphan Test");

    expect(await prisma.user.findUnique({ where: { id: orphanUser.id } })).toBeNull();
    expect(await prisma.studentProfile.findUnique({ where: { id: profile.id } })).toBeNull();
  });

  it("refuses to remove an orphan profile that has a learning record, and deletes nothing", async () => {
    const parent = await createParent("parent3@example.com");
    const token = await sessionFor(parent.id);
    // The record has to have been left by *some* parent (ParentOverride.parentId), but that
    // parent is not linked to the student either — the point is the student profile itself has
    // no ParentStudentLink row at all.
    const recordAuthor = await createParent("record-author@example.com");
    const { user: orphanUser, profile } = await createStudent("Busy Orphan", "busy-orphan");
    // Deliberately no ParentStudentLink row, but a real learning record.
    await seedLearningHistory(recordAuthor.id, profile.id);

    const lessonAttemptsBefore = await prisma.lessonAttempt.count({ where: { studentId: profile.id } });
    expect(lessonAttemptsBefore).toBeGreaterThan(0);

    const res = await POST(removeRequest(token, { confirm: "Busy Orphan" }), ctxFor(profile.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/learning record/i);
    expect(body.error).toMatch(/isn't linked to you/i);

    // Nothing was deleted.
    expect(await prisma.user.findUnique({ where: { id: orphanUser.id } })).not.toBeNull();
    expect(await prisma.studentProfile.findUnique({ where: { id: profile.id } })).not.toBeNull();
    expect(await prisma.lessonAttempt.count({ where: { studentId: profile.id } })).toBe(lessonAttemptsBefore);
  });

  it("refuses to remove a User whose role is PARENT, and that user still exists afterwards", async () => {
    const parent = await createParent();
    const token = await sessionFor(parent.id);
    const otherParent = await createParent("other-parent@example.com");
    // otherParent has no StudentProfile at all, but even if a StudentProfile pointed at a
    // PARENT-role user this must be refused — simulate the guard's own lookup path directly by
    // targeting a studentId that does not resolve to a StudentProfile is not the interesting
    // case; the interesting case is a PARENT-role user *with* a profile row somehow present.
    const parentWithProfile = await createParent("parent-with-profile@example.com");
    const bogusProfile = await prisma.studentProfile.create({
      data: { userId: parentWithProfile.id, yearGroup: 7, keyStage: "ks3" },
    });

    const res = await POST(removeRequest(token, { confirm: "Parent" }), ctxFor(bogusProfile.id));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/only student accounts/i);

    expect(await prisma.user.findUnique({ where: { id: parentWithProfile.id } })).not.toBeNull();
    expect(await prisma.studentProfile.findUnique({ where: { id: bogusProfile.id } })).not.toBeNull();
    void otherParent;
  });

  it("refuses a wrong confirmation name and deletes nothing", async () => {
    const parent = await createParent();
    const token = await sessionFor(parent.id);
    const { user: studentUser, profile } = await createStudent("Rich", "rich2");
    await prisma.parentStudentLink.create({ data: { parentId: parent.id, studentId: studentUser.id } });

    const res = await POST(removeRequest(token, { confirm: "Not Rich" }), ctxFor(profile.id));
    expect(res.status).toBe(400);

    expect(await prisma.user.findUnique({ where: { id: studentUser.id } })).not.toBeNull();
    expect(await prisma.studentProfile.findUnique({ where: { id: profile.id } })).not.toBeNull();
  });

  it("refuses an empty confirmation name and deletes nothing", async () => {
    const parent = await createParent();
    const token = await sessionFor(parent.id);
    const { user: studentUser, profile } = await createStudent("Rich", "rich3");
    await prisma.parentStudentLink.create({ data: { parentId: parent.id, studentId: studentUser.id } });

    const res = await POST(removeRequest(token, { confirm: "" }), ctxFor(profile.id));
    expect(res.status).toBe(400);

    expect(await prisma.user.findUnique({ where: { id: studentUser.id } })).not.toBeNull();
  });

  it("a student session cannot reach the endpoint", async () => {
    const parent = await createParent();
    await sessionFor(parent.id);
    const { user: studentUser, profile } = await createStudent("Rich", "rich4");
    await prisma.parentStudentLink.create({ data: { parentId: parent.id, studentId: studentUser.id } });
    const studentToken = await sessionFor(studentUser.id);

    const res = await POST(removeRequest(studentToken, { confirm: "Rich" }), ctxFor(profile.id));
    expect(res.status).toBe(403);

    expect(await prisma.user.findUnique({ where: { id: studentUser.id } })).not.toBeNull();
  });

  it("another parent's linked student cannot be removed by a parent who is not linked to them", async () => {
    const ownerParent = await createParent("owner@example.com");
    const otherParent = await createParent("other@example.com");
    const otherToken = await sessionFor(otherParent.id);
    const { user: studentUser, profile } = await createStudent("Rich", "rich5");
    await prisma.parentStudentLink.create({ data: { parentId: ownerParent.id, studentId: studentUser.id } });

    const res = await POST(removeRequest(otherToken, { confirm: "Rich" }), ctxFor(profile.id));
    expect(res.status).toBe(404);

    expect(await prisma.user.findUnique({ where: { id: studentUser.id } })).not.toBeNull();
    expect(await prisma.studentProfile.findUnique({ where: { id: profile.id } })).not.toBeNull();
  });
});
