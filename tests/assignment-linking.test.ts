import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { todayDateOnly } from "@/lib/dates";
import { startOrResumeAttempt, completeStage, submitStage } from "@/lib/lessons/service";

/**
 * Two related bugs: an assignment id taken from the URL/body without checking it belongs to
 * this student and this lesson (§4), and a resumed attempt that ignores today's assignment
 * entirely, so finishing it never ticks the board unless the child happened to start via that
 * exact slot (§3).
 */
async function buildStudentAndLesson(studentUsername: string) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: studentUsername, passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 7, keyStage: "ks3" } });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: `s${Math.random()}`, title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: `p${Math.random()}`, subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: `u${Math.random()}`, programmeId: programme.id, title: "Unit", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { provider: "test", providerSlug: `l${Math.random()}`, unitId: unit.id, title: "Lesson", order: 1 },
  });
  return { studentId: student.id, subjectId: subject.id, lessonId: lesson.id };
}

describe("assignment id validation", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("ignores an assignment id that belongs to another student", async () => {
    const a = await buildStudentAndLesson("eva");
    const b = await buildStudentAndLesson("liam");

    // b's own slot for b's own lesson.
    const bsAssignment = await prisma.dailyAssignment.create({
      data: {
        studentId: b.studentId,
        date: todayDateOnly(),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        subjectId: b.subjectId,
        lessonId: b.lessonId,
        estimatedMinutes: 45,
      },
    });

    // a tries to start a's own lesson but passes b's assignment id.
    const attempt = await startOrResumeAttempt(a.studentId, a.lessonId, bsAssignment.id);
    expect(attempt.assignmentId).toBeNull();

    // b's slot must not have been touched by a's request.
    const untouched = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: bsAssignment.id } });
    expect(untouched.status).toBe("PLANNED");
  });

  it("ignores an assignment id that names a different lesson", async () => {
    const a = await buildStudentAndLesson("eva2");
    const otherLesson = await prisma.lesson.create({
      data: { provider: "test", providerSlug: `other${Math.random()}`, unitId: (await prisma.unit.findFirstOrThrow({ where: { programme: { subjectId: a.subjectId } } })).id, title: "Other lesson", order: 2 },
    });
    const wrongLessonAssignment = await prisma.dailyAssignment.create({
      data: {
        studentId: a.studentId,
        date: todayDateOnly(),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        subjectId: a.subjectId,
        lessonId: otherLesson.id,
        estimatedMinutes: 45,
      },
    });

    const attempt = await startOrResumeAttempt(a.studentId, a.lessonId, wrongLessonAssignment.id);
    expect(attempt.assignmentId).toBeNull();
  });

  it("ignores an assignment id for a kind that can never be this lesson (e.g. READING)", async () => {
    const a = await buildStudentAndLesson("eva3");
    const readingAssignment = await prisma.dailyAssignment.create({
      data: {
        studentId: a.studentId,
        date: todayDateOnly(),
        order: 0,
        kind: "READING",
        source: "AUTO",
        estimatedMinutes: 20,
      },
    });

    const attempt = await startOrResumeAttempt(a.studentId, a.lessonId, readingAssignment.id);
    expect(attempt.assignmentId).toBeNull();
  });

  it("accepts a REVIEW assignment for the same student and lesson", async () => {
    const a = await buildStudentAndLesson("eva4");
    const reviewAssignment = await prisma.dailyAssignment.create({
      data: {
        studentId: a.studentId,
        date: todayDateOnly(),
        order: 0,
        kind: "REVIEW",
        source: "REVIEW_ENGINE",
        subjectId: a.subjectId,
        lessonId: a.lessonId,
        estimatedMinutes: 15,
      },
    });

    const attempt = await startOrResumeAttempt(a.studentId, a.lessonId, reviewAssignment.id);
    expect(attempt.assignmentId).toBe(reviewAssignment.id);
  });
});

describe("resuming an attempt attaches today's assignment", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("attaches a valid assignment id to an attempt that started without one, and marks the slot in progress", async () => {
    const a = await buildStudentAndLesson("eva5");

    // Started via "Start the next lesson" — no assignment id at all.
    const attempt = await startOrResumeAttempt(a.studentId, a.lessonId);
    expect(attempt.assignmentId).toBeNull();

    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId: a.studentId,
        date: todayDateOnly(),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        subjectId: a.subjectId,
        lessonId: a.lessonId,
        estimatedMinutes: 45,
      },
    });

    // Opened again, this time from the board — the same IN_PROGRESS attempt resumes, but now
    // picks up the slot it should be tied to.
    const resumed = await startOrResumeAttempt(a.studentId, a.lessonId, assignment.id);
    expect(resumed.id).toBe(attempt.id);
    expect(resumed.assignmentId).toBe(assignment.id);

    const assignmentAfter = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(assignmentAfter.status).toBe("IN_PROGRESS");
  });

  it("ticks today's LESSON assignment on completion even though the attempt never had one", async () => {
    const a = await buildStudentAndLesson("eva6");
    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId: a.studentId,
        date: todayDateOnly(),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        subjectId: a.subjectId,
        lessonId: a.lessonId,
        estimatedMinutes: 45,
      },
    });

    // Started without an assignment id (e.g. "Start the next lesson"); the lesson has no
    // questions in any stage, so CHECK grades as an empty round.
    const attempt = await startOrResumeAttempt(a.studentId, a.lessonId);
    expect(attempt.assignmentId).toBeNull();

    await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { currentStage: "CHECK" } });
    await submitStage(attempt.id, a.studentId, "CHECK");
    await completeStage(attempt.id, a.studentId, "FEEDBACK");
    const done = await completeStage(attempt.id, a.studentId, "COMPLETE");
    expect(["COMPLETED", "MASTERED", "NEEDS_REVIEW"]).toContain(done.status);

    const assignmentAfter = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(assignmentAfter.status).toBe("COMPLETED");
    expect(assignmentAfter.completedAt).not.toBeNull();
  });

  it("does not tick a different student's assignment for the same lesson", async () => {
    const a = await buildStudentAndLesson("eva7");
    const b = await buildStudentAndLesson("liam2");
    // b happens to have the exact same lesson id scheduled today too? Not possible across
    // different lesson rows — but guard against ever matching on lessonId alone regardless of
    // student by using a's own lessonId scoped to a's own studentId query.
    const bAssignment = await prisma.dailyAssignment.create({
      data: {
        studentId: b.studentId,
        date: todayDateOnly(),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        subjectId: b.subjectId,
        lessonId: b.lessonId,
        estimatedMinutes: 45,
      },
    });

    const attempt = await startOrResumeAttempt(a.studentId, a.lessonId);
    await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { currentStage: "CHECK" } });
    await submitStage(attempt.id, a.studentId, "CHECK");
    await completeStage(attempt.id, a.studentId, "FEEDBACK");
    await completeStage(attempt.id, a.studentId, "COMPLETE");

    const untouched = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: bAssignment.id } });
    expect(untouched.status).toBe("PLANNED");
  });
});
