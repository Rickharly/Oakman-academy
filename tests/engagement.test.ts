import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import {
  endFocusEvent,
  expectedStart,
  getDayEngagement,
  markDayStarted,
  openSchoolDay,
  plannedStartInstant,
  recordAttemptPunctuality,
  recordTimeBreakdown,
  startFocusEvent,
} from "@/lib/engagement/service";
import { toDateOnly } from "@/lib/dates";

const DATE = "2026-09-07"; // a Monday

let studentId: string;
let lessonId: string;

async function build() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "punctual", passwordHash: "x", displayName: "Tester" },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3", schoolStartTime: "13:00", breakMinutes: 10 },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: "m:7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: "u1", programmeId: programme.id, title: "Unit", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { provider: "test", providerSlug: "l1", unitId: unit.id, title: "Fractions", order: 1, estimatedMinutes: 45 },
  });
  return { studentId: profile.id, lessonId: lesson.id, subjectId: subject.id };
}

async function makeAssignment(order: number, subjectId: string, minutes = 45) {
  return prisma.dailyAssignment.create({
    data: {
      studentId,
      date: toDateOnly(DATE),
      order,
      kind: "LESSON",
      source: "AUTO",
      subjectId,
      lessonId,
      estimatedMinutes: minutes,
    },
  });
}

let subjectId: string;

beforeEach(async () => {
  await resetDb();
  const built = await build();
  studentId = built.studentId;
  lessonId = built.lessonId;
  subjectId = built.subjectId;
});

describe("when the school day starts", () => {
  it("records how late the day began against the timetable", async () => {
    // 13:20 London on a September Monday — twenty minutes after the planned 13:00.
    const at = new Date(plannedStartInstant(DATE, "13:00").getTime() + 20 * 60_000);
    const day = await markDayStarted(studentId, at, DATE);

    expect(day.startedLateSeconds).toBe(20 * 60);
  });

  it("records an early start as a negative number rather than pretending it was on time", async () => {
    const at = new Date(plannedStartInstant(DATE, "13:00").getTime() - 5 * 60_000);
    const day = await markDayStarted(studentId, at, DATE);

    expect(day.startedLateSeconds).toBe(-5 * 60);
  });

  it("anchors the day once — starting a second lesson does not move it", async () => {
    const first = new Date(plannedStartInstant(DATE, "13:00").getTime() + 10 * 60_000);
    await markDayStarted(studentId, first, DATE);
    const again = await markDayStarted(studentId, new Date(first.getTime() + 60 * 60_000), DATE);

    expect(again.startedAt?.getTime()).toBe(first.getTime());
    expect(again.startedLateSeconds).toBe(10 * 60);
  });

  it("opens one row per day, however many times it is called", async () => {
    await openSchoolDay(studentId, DATE);
    await openSchoolDay(studentId, DATE);
    expect(await prisma.schoolDay.count({ where: { studentId } })).toBe(1);
  });
});

describe("when each period is due", () => {
  it("counts the periods and the breaks between them", () => {
    const start = new Date("2026-09-07T12:00:00Z");
    // Third period: two 45-minute periods and two 10-minute breaks have gone before it.
    expect(expectedStart(start, 90, 2, 10).toISOString()).toBe("2026-09-07T13:50:00.000Z");
  });

  it("measures a period against the day's real start, not the clock", async () => {
    // The child starts 30 minutes late. Period one is on time *for them*; the day shifted.
    const lateStart = new Date(plannedStartInstant(DATE, "13:00").getTime() + 30 * 60_000);
    const first = await makeAssignment(0, subjectId);
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, assignmentId: first.id, attemptNumber: 1 },
    });

    await recordAttemptPunctuality(attempt, lateStart);

    const saved = await prisma.lessonAttempt.findUnique({ where: { id: attempt.id } });
    expect(saved!.startedLateSeconds).toBe(0);

    // The day itself is recorded as half an hour late — once.
    const day = await prisma.schoolDay.findFirst({ where: { studentId } });
    expect(day!.startedLateSeconds).toBe(30 * 60);
  });

  it("catches a period that started late within the day", async () => {
    const dayStart = plannedStartInstant(DATE, "13:00");
    const first = await makeAssignment(0, subjectId);
    const second = await makeAssignment(1, subjectId);

    const a1 = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, assignmentId: first.id, attemptNumber: 1 },
    });
    await recordAttemptPunctuality(a1, dayStart);

    // Period two was due 55 minutes in (45 + a 10-minute break); they turned up 70 minutes in.
    const a2 = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, assignmentId: second.id, attemptNumber: 2 },
    });
    await recordAttemptPunctuality(a2, new Date(dayStart.getTime() + 70 * 60_000));

    const saved = await prisma.lessonAttempt.findUnique({ where: { id: a2.id } });
    expect(saved!.startedLateSeconds).toBe(15 * 60);
  });

  it("expects nothing of a lesson opened outside the timetable", async () => {
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 1 },
    });
    await recordAttemptPunctuality(attempt);

    const saved = await prisma.lessonAttempt.findUnique({ where: { id: attempt.id } });
    expect(saved!.expectedStartAt).toBeNull();
    expect(saved!.startedLateSeconds).toBeNull();
  });
});

describe("how the time inside a period was spent", () => {
  it("adds up active, idle and away separately", async () => {
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 1 },
    });

    await recordTimeBreakdown(attempt.id, studentId, { activeSeconds: 30, idleSeconds: 0, awaySeconds: 0 });
    await recordTimeBreakdown(attempt.id, studentId, { activeSeconds: 10, idleSeconds: 20, awaySeconds: 0 });
    await recordTimeBreakdown(attempt.id, studentId, { activeSeconds: 0, idleSeconds: 0, awaySeconds: 60 });

    const saved = await prisma.lessonAttempt.findUnique({ where: { id: attempt.id } });
    expect(saved!.activeSeconds).toBe(40);
    expect(saved!.idleSeconds).toBe(20);
    expect(saved!.awaySeconds).toBe(60);
  });

  it("refuses a slice big enough to be a lie", async () => {
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 1 },
    });
    // A tab left open overnight, or a tampered request.
    await recordTimeBreakdown(attempt.id, studentId, { activeSeconds: 99_999, idleSeconds: 0, awaySeconds: 0 });

    const saved = await prisma.lessonAttempt.findUnique({ where: { id: attempt.id } });
    expect(saved!.activeSeconds).toBe(600);
  });

  it("will not let one child write to another child's attempt", async () => {
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 1 },
    });
    await recordTimeBreakdown(attempt.id, "someone-else", { activeSeconds: 60, idleSeconds: 0, awaySeconds: 0 });

    const saved = await prisma.lessonAttempt.findUnique({ where: { id: attempt.id } });
    expect(saved!.activeSeconds).toBe(0);
  });
});

describe("stepping away", () => {
  it("records why, and how long", async () => {
    const { id } = await startFocusEvent(studentId, { kind: "TOILET" });
    const seconds = await endFocusEvent(studentId, id);

    const event = await prisma.focusEvent.findUnique({ where: { id } });
    expect(event!.kind).toBe("TOILET");
    expect(event!.endedAt).not.toBeNull();
    expect(seconds).toBeGreaterThanOrEqual(0);
  });

  it("does not open a second break while one is already open", async () => {
    const first = await startFocusEvent(studentId, { kind: "TOILET" });
    const second = await startFocusEvent(studentId, { kind: "DRINK" });

    expect(second.id).toBe(first.id);
    expect(await prisma.focusEvent.count({ where: { studentId } })).toBe(1);
  });

  it("caps a break left open by a forgotten button press", async () => {
    const { id } = await startFocusEvent(studentId, { kind: "OTHER", note: "forgot" });
    // Pretend they pressed it eight hours ago and never came back.
    await prisma.focusEvent.update({
      where: { id },
      data: { startedAt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
    });

    const seconds = await endFocusEvent(studentId, id);
    expect(seconds).toBe(2 * 60 * 60);
  });

  it("coming back with nothing open is harmless", async () => {
    expect(await endFocusEvent(studentId)).toBe(0);
  });
});

describe("the day a parent reads", () => {
  it("separates explained absence from drifting off", async () => {
    const dayStart = plannedStartInstant(DATE, "13:00");
    const assignment = await makeAssignment(0, subjectId);
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, assignmentId: assignment.id, attemptNumber: 1 },
    });
    await recordAttemptPunctuality(attempt, new Date(dayStart.getTime() + 12 * 60_000));

    // 20 minutes working, 10 minutes staring into space, 5 minutes at the toilet.
    for (let i = 0; i < 4; i++) {
      await recordTimeBreakdown(attempt.id, studentId, {
        activeSeconds: 300,
        idleSeconds: 150,
        awaySeconds: 75,
      });
    }
    const { id } = await startFocusEvent(studentId, { attemptId: attempt.id, kind: "TOILET" });
    await endFocusEvent(studentId, id);

    const day = await getDayEngagement(studentId, DATE);

    expect(day.startedLateMinutes).toBe(12);
    expect(day.activeMinutes).toBe(20);
    expect(day.idleMinutes).toBe(10);
    expect(day.awayMinutes).toBe(5);
    // Flagged time is not held against them, so the ratio is active / (active + idle).
    expect(day.focusRatio).toBeCloseTo(20 / 30, 5);
    expect(day.breaks.map((b) => b.kind)).toEqual(["TOILET"]);
  });

  it("says nothing rather than guessing when no work was recorded", async () => {
    const day = await getDayEngagement(studentId, DATE);
    expect(day.focusRatio).toBeNull();
    expect(day.startedLateMinutes).toBeNull();
    expect(day.lateStarts).toEqual([]);
  });
});
