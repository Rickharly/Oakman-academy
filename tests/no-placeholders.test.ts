import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { lessonProvenance, sweepPlaceholders } from "@/lib/admin/no-placeholders";
import { ensureDayPlanned } from "@/lib/scheduling/planner";
import { toDateOnly, weekStartKey } from "@/lib/dates";

/**
 * The bundled sample curriculum must never reach a child. Its lessons are invented and its
 * videos are `fixture://` addresses pointing at nothing, which is why "the video is broken" was
 * the story for days when the truth was that there was no video.
 *
 * Every guard before this was a preference — prefer Oak where Oak exists — and a preference
 * fails whenever an enrolment is wrong in a way nobody predicted. These hold the floor.
 */
const MONDAY = weekStartKey("2026-09-07");

async function childOnBothCurricula() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "mikhael", passwordHash: "x", displayName: "Mikhael" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 4, keyStage: "ks2", lessonsPerDay: 1, lessonMinutes: 45 },
  });

  type Made = { subjectId: string; programmeId: string; lessonId: string };
  const made = {} as Record<"fixture" | "oak", Made>;
  for (const provider of ["fixture", "oak"] as const) {
    const subject = await prisma.subject.create({
      data: { provider, slug: "maths", title: "Maths" },
    });
    const programme = await prisma.programme.create({
      data: {
        provider,
        providerSlug: `maths:4:${provider}`,
        subjectId: subject.id,
        yearGroup: 4,
        keyStage: "ks2",
        title: "Maths",
      },
    });
    const unit = await prisma.unit.create({
      data: { provider, providerSlug: `u-${provider}`, programmeId: programme.id, title: "U", order: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: {
        provider,
        providerSlug: `l-${provider}`,
        unitId: unit.id,
        title: provider === "fixture" ? "An invented lesson" : "A real Oak lesson",
        order: 1,
      },
    });
    made[provider] = { subjectId: subject.id, programmeId: programme.id, lessonId: lesson.id };
  }

  return { studentId: student.id, ...made };
}

describe("the sample curriculum", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("is never scheduled, even when the child is enrolled on it", async () => {
    const { studentId, fixture } = await childOnBothCurricula();
    // Enrolled on the placeholder programme only, and timetabled against its subject row.
    await prisma.studentEnrolment.create({ data: { studentId, programmeId: fixture.programmeId } });
    await prisma.studentSchedule.create({
      data: { studentId, subjectId: fixture.subjectId, weeklyFrequency: 5, priority: 1 },
    });

    await ensureDayPlanned(studentId, MONDAY);

    const planned = await prisma.dailyAssignment.findMany({
      where: { studentId, date: toDateOnly(MONDAY), kind: "LESSON" },
      include: { lesson: true },
    });
    // The floor: whatever the enrolments say, an invented lesson cannot be set.
    expect(planned.every((a) => a.lesson?.provider !== "fixture")).toBe(true);
  });

  it("is swept off a child, and real work is left alone", async () => {
    const { studentId, fixture, oak } = await childOnBothCurricula();
    await prisma.studentEnrolment.create({ data: { studentId, programmeId: fixture.programmeId } });
    await prisma.studentEnrolment.create({ data: { studentId, programmeId: oak.programmeId } });
    await prisma.studentSchedule.create({
      data: { studentId, subjectId: fixture.subjectId, weeklyFrequency: 5, priority: 1 },
    });
    await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(MONDAY),
        order: 0,
        kind: "LESSON",
        subjectId: fixture.subjectId,
        lessonId: fixture.lessonId,
        estimatedMinutes: 45,
        source: "AUTO",
      },
    });

    const swept = await sweepPlaceholders(studentId);
    expect(swept.assignmentsRemoved).toBe(1);
    expect(swept.enrolmentsDeactivated).toBe(1);

    const stillEnrolled = await prisma.studentEnrolment.findMany({
      where: { studentId, active: true },
      include: { programme: true },
    });
    expect(stillEnrolled).toHaveLength(1);
    expect(stillEnrolled[0].programme.provider).toBe("oak");

    // The timetable line survives — moved onto the real subject row, not deleted, because
    // deleting it would silently drop maths from the week.
    const schedule = await prisma.studentSchedule.findFirstOrThrow({
      where: { studentId, active: true },
      include: { subject: true },
    });
    expect(schedule.subject.provider).toBe("oak");
  });

  it("never deletes a lesson they actually sat, however invented it was", async () => {
    const { studentId, fixture } = await childOnBothCurricula();
    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(MONDAY),
        order: 0,
        kind: "LESSON",
        subjectId: fixture.subjectId,
        lessonId: fixture.lessonId,
        estimatedMinutes: 45,
        source: "AUTO",
        status: "IN_PROGRESS",
      },
    });
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId: fixture.lessonId, assignmentId: assignment.id, attemptNumber: 1 },
    });
    const activity = await prisma.activityAttempt.create({
      data: { lessonAttemptId: attempt.id, stage: "CHECK", attemptNumber: 1, status: "GRADED" },
    });
    const question = await prisma.question.create({
      data: {
        lessonId: fixture.lessonId,
        source: "OAK_EXIT_QUIZ",
        stage: "CHECK",
        order: 1,
        type: "TRUE_FALSE",
        prompt: "Was this invented?",
        options: {},
        answerKey: { value: true },
        maxScore: 1,
        gradingMode: "DETERMINISTIC",
        providerRef: "q1",
      },
    });
    await prisma.questionAttempt.create({
      data: {
        activityAttemptId: activity.id,
        questionId: question.id,
        studentId,
        attemptNumber: 1,
        response: { value: true },
        maxScore: 1,
        gradedBy: "DETERMINISTIC",
      },
    });

    const swept = await sweepPlaceholders(studentId);
    // An hour of a child's life is still an hour of their life. Their record is not ours to
    // rewrite to tidy up a mistake of ours.
    expect(swept.assignmentsRemoved).toBe(0);
    expect(await prisma.dailyAssignment.findUnique({ where: { id: assignment.id } })).not.toBeNull();
  });

  it("names a subject left with nothing real to teach rather than dropping it quietly", async () => {
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
    });
    const student = await prisma.studentProfile.create({
      data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
    });
    const subject = await prisma.subject.create({
      data: { provider: "fixture", slug: "history", title: "History" },
    });
    await prisma.studentSchedule.create({
      data: { studentId: student.id, subjectId: subject.id, weeklyFrequency: 2, priority: 1 },
    });

    const swept = await sweepPlaceholders(student.id);
    expect(swept.subjectsLeftEmpty).toContain("History");
  });

  it("reports the provider of every lesson on the board", async () => {
    const { studentId, oak } = await childOnBothCurricula();
    await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"),
        order: 0,
        kind: "LESSON",
        subjectId: oak.subjectId,
        lessonId: oak.lessonId,
        estimatedMinutes: 45,
        source: "AUTO",
      },
    });

    const lines = await lessonProvenance();
    const mine = lines.find((l) => l.studentName === "Mikhael");
    expect(mine?.today[0]?.provider).toBe("oak");
  });
});
