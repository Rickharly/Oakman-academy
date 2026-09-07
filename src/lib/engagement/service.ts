/**
 * How the school day was actually worked: when it started, whether each period began on time,
 * and how the time inside a period was spent.
 *
 * Two principles run through this:
 *
 * 1. **The day is anchored to the first lesson, not to the clock.** If a child starts at 13:20
 *    instead of 13:00, the day shifts by twenty minutes. Being late once is recorded once, on
 *    the day; it does not make every later period late as well.
 * 2. **Unexplained time and explained time are different things.** A child who presses "I need
 *    a moment" and says they went to the toilet has not lost focus — they have gone to the
 *    toilet. Only silence with no reason counts as idle.
 *
 * None of this is shown to the child. It is a signal for a parent reading the record later,
 * and a child who feels stopwatched works worse, not better.
 */
import { prisma } from "@/lib/db";
import type { FocusEventKind, LessonAttempt, SchoolDay } from "@/generated/prisma/client";
import { SCHOOL_TIMEZONE, schoolDayKey, toDateOnly } from "@/lib/dates";
import { fromZonedTime } from "date-fns-tz";

/** A gap with no interaction longer than this is idle rather than thinking time. */
export const IDLE_AFTER_SECONDS = 120;

function parseTime(value: string): { hours: number; minutes: number } {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { hours: 9, minutes: 0 };
  return { hours: Math.min(23, Math.max(0, h)), minutes: Math.min(59, Math.max(0, m)) };
}

/** The instant the timetable's start time falls on, in the family's timezone. */
export function plannedStartInstant(dateKey: string, startTime: string): Date {
  const { hours, minutes } = parseTime(startTime);
  const local = `${dateKey}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  return fromZonedTime(local, SCHOOL_TIMEZONE);
}

/**
 * Opens (or returns) the record of today's school day. Called the first time a child starts
 * anything; the day's anchor is set once and never moved.
 */
export async function openSchoolDay(studentId: string, dateKey = schoolDayKey()): Promise<SchoolDay> {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) throw new Error("Student not found");

  const existing = await prisma.schoolDay.findUnique({
    where: { studentId_date: { studentId, date: toDateOnly(dateKey) } },
  });
  if (existing) return existing;

  return prisma.schoolDay.create({
    data: {
      studentId,
      date: toDateOnly(dateKey),
      plannedStartTime: student.schoolStartTime,
    },
  });
}

/**
 * Records that work has begun. The first call of the day sets the anchor and the day's
 * lateness; later calls only touch `lastActivityAt`.
 */
export async function markDayStarted(
  studentId: string,
  at = new Date(),
  dateKey = schoolDayKey(),
): Promise<SchoolDay> {
  const day = await openSchoolDay(studentId, dateKey);
  if (day.startedAt) {
    return prisma.schoolDay.update({ where: { id: day.id }, data: { lastActivityAt: at } });
  }

  const planned = plannedStartInstant(dateKey, day.plannedStartTime);
  return prisma.schoolDay.update({
    where: { id: day.id },
    data: {
      startedAt: at,
      startedLateSeconds: Math.round((at.getTime() - planned.getTime()) / 1000),
      lastActivityAt: at,
    },
  });
}

/**
 * When the timetable expects a given period to begin, measured from the day's actual start.
 *
 * `precedingMinutes` is the total length of everything scheduled before it, and
 * `precedingBreaks` how many breaks fall in between.
 */
export function expectedStart(
  dayStartedAt: Date,
  precedingMinutes: number,
  precedingBreaks: number,
  breakMinutes: number,
): Date {
  const offset = (precedingMinutes + precedingBreaks * breakMinutes) * 60_000;
  return new Date(dayStartedAt.getTime() + offset);
}

/**
 * Called when a lesson attempt is created: works out when this period was due to start and
 * how late it actually began.
 *
 * A lesson opened outside its own assignment (revision, a parent-set extra) has no expectation
 * to miss, so nothing is recorded.
 */
export async function recordAttemptPunctuality(attempt: LessonAttempt, at = new Date()): Promise<void> {
  if (!attempt.assignmentId) return;

  const assignment = await prisma.dailyAssignment.findUnique({ where: { id: attempt.assignmentId } });
  if (!assignment) return;

  const dateKey = assignment.date.toISOString().slice(0, 10);
  const day = await markDayStarted(attempt.studentId, at, dateKey);
  if (!day.startedAt) return;

  const student = await prisma.studentProfile.findUnique({ where: { id: attempt.studentId } });
  if (!student) return;

  // Everything scheduled before this one, in the order the day runs.
  const before = await prisma.dailyAssignment.findMany({
    where: {
      studentId: attempt.studentId,
      date: assignment.date,
      status: { not: "MOVED" },
      order: { lt: assignment.order },
    },
    orderBy: { order: "asc" },
  });

  const precedingMinutes = before.reduce((n, a) => n + a.estimatedMinutes, 0);
  const due = expectedStart(day.startedAt, precedingMinutes, before.length, student.breakMinutes);

  await prisma.lessonAttempt.update({
    where: { id: attempt.id },
    data: {
      expectedStartAt: due,
      startedLateSeconds: Math.round((at.getTime() - due.getTime()) / 1000),
    },
  });
}

/**
 * Adds a slice of time to an attempt, split into how it was spent.
 *
 * The caller is the browser, so every number is clamped: a tab left open overnight, a clock
 * change, or a tampered request must not be able to write a ten-hour lesson.
 */
export async function recordTimeBreakdown(
  attemptId: string,
  studentId: string,
  slice: { activeSeconds: number; idleSeconds: number; awaySeconds: number },
): Promise<void> {
  const clamp = (n: number) => Math.max(0, Math.min(Math.round(Number.isFinite(n) ? n : 0), 600));
  const active = clamp(slice.activeSeconds);
  const idle = clamp(slice.idleSeconds);
  const away = clamp(slice.awaySeconds);
  if (active + idle + away === 0) return;

  const attempt = await prisma.lessonAttempt.findFirst({ where: { id: attemptId, studentId } });
  if (!attempt) return;

  await prisma.lessonAttempt.update({
    where: { id: attempt.id },
    data: {
      activeSeconds: { increment: active },
      idleSeconds: { increment: idle },
      awaySeconds: { increment: away },
    },
  });

  await prisma.schoolDay
    .updateMany({
      where: { studentId, date: toDateOnly(schoolDayKey()) },
      data: { lastActivityAt: new Date() },
    })
    .catch(() => undefined);
}

/** The child pressed "I need a moment". */
export async function startFocusEvent(
  studentId: string,
  input: { attemptId?: string; kind: FocusEventKind; note?: string },
): Promise<{ id: string }> {
  // One open event at a time: pressing it twice should not create a second.
  const open = await prisma.focusEvent.findFirst({
    where: { studentId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open) return { id: open.id };

  const event = await prisma.focusEvent.create({
    data: {
      studentId,
      attemptId: input.attemptId ?? null,
      date: toDateOnly(schoolDayKey()),
      kind: input.kind,
      note: input.note?.slice(0, 200) || null,
    },
  });
  return { id: event.id };
}

/** They came back. Returns how long they were away, in seconds. */
export async function endFocusEvent(studentId: string, eventId?: string): Promise<number> {
  const event = eventId
    ? await prisma.focusEvent.findFirst({ where: { id: eventId, studentId, endedAt: null } })
    : await prisma.focusEvent.findFirst({
        where: { studentId, endedAt: null },
        orderBy: { startedAt: "desc" },
      });
  if (!event) return 0;

  const endedAt = new Date();
  // A break left open overnight is a forgotten button press, not an eight-hour absence.
  const seconds = Math.min(
    Math.round((endedAt.getTime() - event.startedAt.getTime()) / 1000),
    2 * 60 * 60,
  );

  await prisma.focusEvent.update({ where: { id: event.id }, data: { endedAt, seconds } });
  return seconds;
}

export type DayEngagement = {
  dateKey: string;
  plannedStartTime: string;
  startedAt: Date | null;
  startedLateMinutes: number | null;
  activeMinutes: number;
  idleMinutes: number;
  awayMinutes: number;
  /** Share of recorded time spent interacting, 0–1. Null when nothing was recorded. */
  focusRatio: number | null;
  lateStarts: { title: string; lateMinutes: number }[];
  breaks: { kind: FocusEventKind; note: string | null; minutes: number; at: Date }[];
};

/** Everything a parent needs to see how a day actually went. */
export async function getDayEngagement(studentId: string, dateKey: string): Promise<DayEngagement> {
  const date = toDateOnly(dateKey);
  const [day, attempts, events] = await Promise.all([
    prisma.schoolDay.findUnique({ where: { studentId_date: { studentId, date } } }),
    prisma.lessonAttempt.findMany({
      where: { studentId, assignment: { date } },
      include: { lesson: { select: { title: true } } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.focusEvent.findMany({ where: { studentId, date }, orderBy: { startedAt: "asc" } }),
  ]);

  const activeSeconds = attempts.reduce((n, a) => n + a.activeSeconds, 0);
  const idleSeconds = attempts.reduce((n, a) => n + a.idleSeconds, 0);
  const awaySeconds = attempts.reduce((n, a) => n + a.awaySeconds, 0);
  const recorded = activeSeconds + idleSeconds;

  return {
    dateKey,
    plannedStartTime: day?.plannedStartTime ?? "",
    startedAt: day?.startedAt ?? null,
    startedLateMinutes:
      day?.startedLateSeconds == null ? null : Math.round(day.startedLateSeconds / 60),
    activeMinutes: Math.round(activeSeconds / 60),
    idleMinutes: Math.round(idleSeconds / 60),
    awayMinutes: Math.round(awaySeconds / 60),
    // Time they told us about is not held against them, so it is left out of the ratio.
    focusRatio: recorded > 0 ? activeSeconds / recorded : null,
    lateStarts: attempts
      .filter((a) => (a.startedLateSeconds ?? 0) >= 5 * 60)
      .map((a) => ({
        title: a.lesson.title,
        lateMinutes: Math.round((a.startedLateSeconds ?? 0) / 60),
      })),
    breaks: events
      .filter((e) => e.kind !== "IDLE")
      .map((e) => ({
        kind: e.kind,
        note: e.note,
        minutes: Math.max(1, Math.round((e.seconds ?? 0) / 60)),
        at: e.startedAt,
      })),
  };
}
