/**
 * Weekly scheduler (spec §28–§30; ARCHITECTURE §7). Deterministic given the
 * same DB state: same inputs → same plan, so re-planning is stable and safe
 * to call repeatedly.
 */
import { prisma } from "@/lib/db";
import type { DailyAssignment, Lesson, Programme, ReviewItem, StudentLessonProgress, Subject, Unit } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { addDaysKey, dateOnlyKey, isoWeekday, schoolDayEnd, todayDateOnly, toDateOnly, weekStartKey } from "@/lib/dates";

const REVIEW_MINUTES = 15;
const MAX_REVIEWS_PER_DAY = 2;
/** The short reading slot that closes the day. Deliberately not a full period. */
const READING_MINUTES = 20;

export interface TodayView {
  dateKey: string;
  assignments: (DailyAssignment & {
    lesson: (Lesson & { unit: Unit & { programme: Programme & { subject: Subject } } }) | null;
    progress: StudentLessonProgress | null;
    reviewItem: ReviewItem | null;
  })[];
  totalMinutes: number;
  completedToday: number;
  totalToday: number;
  completedWeek: number;
  totalWeek: number;
}

type Slot = {
  kind: "REVIEW" | "LESSON" | "READING";
  subjectId?: string;
  lessonId?: string;
  reviewItemId?: string;
  estimatedMinutes: number;
  optional?: boolean;
  movedTo?: string;
};

function sumSlots(slots: Slot[] | undefined): number {
  return (slots ?? []).reduce((sum, s) => sum + s.estimatedMinutes, 0);
}


async function getIncompleteLessonSequence(studentId: string, programmeId: string): Promise<Lesson[]> {
  const units = await prisma.unit.findMany({
    where: { programmeId },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  const lessons = units.flatMap((u) => u.lessons);
  if (lessons.length === 0) return [];

  const progressRows = await prisma.studentLessonProgress.findMany({
    where: { studentId, lessonId: { in: lessons.map((l) => l.id) } },
  });
  const doneIds = new Set(progressRows.filter((p) => p.status === "COMPLETED" || p.status === "MASTERED").map((p) => p.lessonId));
  return lessons.filter((l) => !doneIds.has(l.id));
}

export async function planWeek(studentId: string, weekStart: string, opts?: { replace?: boolean }): Promise<DailyAssignment[]> {
  const replace = opts?.replace ?? false;
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) throw new Error("Student not found");

  const mondayKey = weekStartKey(weekStart);
  const dayKeys = [0, 1, 2, 3, 4].map((i) => addDaysKey(mondayKey, i));
  const dayDates = dayKeys.map(toDateOnly);

  if (replace) {
    await prisma.dailyAssignment.deleteMany({
      where: { studentId, date: { in: dayDates }, status: "PLANNED", source: "AUTO" },
    });
  }

  const existing = await prisma.dailyAssignment.findMany({ where: { studentId, date: { in: dayDates } } });

  const schedules = await prisma.studentSchedule.findMany({
    where: { studentId, active: true },
    orderBy: [{ priority: "desc" }, { weeklyFrequency: "desc" }],
  });

  const enrolments = await prisma.studentEnrolment.findMany({ where: { studentId, active: true } });
  const programmes = enrolments.length
    ? await prisma.programme.findMany({ where: { id: { in: enrolments.map((e) => e.programmeId) } } })
    : [];
  const programmeIdBySubjectId = new Map(programmes.map((p) => [p.subjectId, p.id]));

  const daySlots = new Map<string, Slot[]>(dayKeys.map((k) => [k, []]));
  const dayExistingMinutes = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  for (const a of existing) {
    if (a.status === "MOVED") continue;
    const key = dateOnlyKey(a.date);
    dayExistingMinutes.set(key, (dayExistingMinutes.get(key) ?? 0) + a.estimatedMinutes);
  }

  // ── Review items first: place each pending item on the earliest planned day it is due by. ──
  const pendingReviews = await prisma.reviewItem.findMany({
    where: { studentId, status: "PENDING", dueAt: { lte: schoolDayEnd(dayKeys[4]) } },
    orderBy: { dueAt: "asc" },
  });
  const pendingReviewsById = new Map(pendingReviews.map((r) => [r.id, r]));
  const scheduledReviewIds = new Set<string>();
  for (const dayKey of dayKeys) {
    const dayTime = toDateOnly(dayKey).getTime();
    for (const item of pendingReviews) {
      if (scheduledReviewIds.has(item.id)) continue;
      if (item.dueAt.getTime() > dayTime) continue;
      // At most two quick reviews a day: they sit alongside the timetable, and a backlog
      // must not turn a school day into an hour of revisiting old work.
      const reviewsToday = daySlots.get(dayKey)!.filter((s) => s.kind === "REVIEW").length;
      if (reviewsToday >= MAX_REVIEWS_PER_DAY) break;
      scheduledReviewIds.add(item.id);
      daySlots.get(dayKey)!.push({ kind: "REVIEW", reviewItemId: item.id, estimatedMinutes: REVIEW_MINUTES });
    }
  }

  // ── Lesson slots: subjects by priority desc, weeklyFrequency desc. ──
  const alreadyDaysBySubject = new Map<string, Set<string>>();
  const usedLessonIdsBySubject = new Map<string, Set<string>>();
  for (const a of existing) {
    if (a.kind !== "LESSON" || !a.subjectId) continue;
    const key = dateOnlyKey(a.date);
    if (a.status !== "MOVED") {
      if (!alreadyDaysBySubject.has(a.subjectId)) alreadyDaysBySubject.set(a.subjectId, new Set());
      alreadyDaysBySubject.get(a.subjectId)!.add(key);
    }
    if (a.lessonId && (a.status === "PLANNED" || a.status === "IN_PROGRESS")) {
      if (!usedLessonIdsBySubject.has(a.subjectId)) usedLessonIdsBySubject.set(a.subjectId, new Set());
      usedLessonIdsBySubject.get(a.subjectId)!.add(a.lessonId);
    }
  }

  for (const schedule of schedules) {
    const subjectId = schedule.subjectId;
    const programmeId = programmeIdBySubjectId.get(subjectId);
    if (!programmeId) continue; // not enrolled in this subject — nothing to schedule

    const alreadyDays = alreadyDaysBySubject.get(subjectId) ?? new Set<string>();
    const neededMore = Math.max(0, schedule.weeklyFrequency - alreadyDays.size);
    if (neededMore === 0) continue;

    const candidateDays = dayKeys.filter((k) => !alreadyDays.has(k));
    let chosen: string[];
    if (schedule.weeklyFrequency >= 5) {
      chosen = candidateDays;
    } else {
      const preferredDays = (Array.isArray(schedule.preferredDays) ? (schedule.preferredDays as number[]) : []).filter(
        (d) => d >= 1 && d <= 5
      );
      const preferredKeys = [...new Set(preferredDays)]
        .sort((a, b) => a - b)
        .map((d) => dayKeys[d - 1])
        .filter((k) => candidateDays.includes(k));
      chosen = preferredKeys.slice(0, neededMore);
      const remaining = neededMore - chosen.length;
      if (remaining > 0) {
        const pool = candidateDays.filter((k) => !chosen.includes(k));
        pool.sort((a, b) => {
          const loadA = (dayExistingMinutes.get(a) ?? 0) + sumSlots(daySlots.get(a));
          const loadB = (dayExistingMinutes.get(b) ?? 0) + sumSlots(daySlots.get(b));
          if (loadA !== loadB) return loadA - loadB;
          return dayKeys.indexOf(a) - dayKeys.indexOf(b);
        });
        chosen.push(...pool.slice(0, remaining));
      }
    }
    chosen.sort((a, b) => dayKeys.indexOf(a) - dayKeys.indexOf(b));
    if (chosen.length === 0) continue;

    const candidateLessons = await getIncompleteLessonSequence(studentId, programmeId);
    const used = usedLessonIdsBySubject.get(subjectId) ?? new Set<string>();

    for (const dayKey of chosen) {
      const lesson = candidateLessons.find((l) => !used.has(l.id));
      if (!lesson) break; // no incomplete lesson left in sequence — no assignment
      used.add(lesson.id);
      daySlots.get(dayKey)!.push({
        kind: "LESSON",
        subjectId,
        lessonId: lesson.id,
        // A period is a fixed length, whatever the lesson content estimates.
        estimatedMinutes: student.lessonMinutes,
      });
    }
    usedLessonIdsBySubject.set(subjectId, used);
  }

  // ── Fill every day to a full timetable. ──
  // Weekly frequencies decide which subject is favoured; the timetable decides how many
  // periods there are. A day is only short when a subject has genuinely run out of lessons.
  const lessonsPerDay = Math.max(1, student.lessonsPerDay);
  const rotation = schedules
    .map((sch) => sch.subjectId)
    .filter((subjectId) => programmeIdBySubjectId.has(subjectId));

  for (const dayKey of dayKeys) {
    const slots = daySlots.get(dayKey)!;
    const existingLessonCount = existing.filter(
      (a) => a.kind === "LESSON" && a.status !== "MOVED" && dateOnlyKey(a.date) === dayKey,
    ).length;

    // Prefer a subject the child does not already have that day, so a full timetable reads
    // like a school week rather than four periods of the same subject.
    let guard = 0;
    while (slots.filter((s) => s.kind === "LESSON").length + existingLessonCount < lessonsPerDay) {
      if (guard++ > rotation.length * 3) break; // every subject is out of lessons

      const subjectsToday = new Set(
        slots.filter((s) => s.kind === "LESSON").map((s) => s.subjectId),
      );
      const ordered = [
        ...rotation.filter((id) => !subjectsToday.has(id)),
        ...rotation.filter((id) => subjectsToday.has(id)),
      ];

      let added = false;
      for (const subjectId of ordered) {
        const programmeId = programmeIdBySubjectId.get(subjectId);
        if (!programmeId) continue;
        const used = usedLessonIdsBySubject.get(subjectId) ?? new Set<string>();
        const candidates = await getIncompleteLessonSequence(studentId, programmeId);
        const lesson = candidates.find((l) => !used.has(l.id));
        if (!lesson) continue;
        used.add(lesson.id);
        usedLessonIdsBySubject.set(subjectId, used);
        slots.push({
          kind: "LESSON",
          subjectId,
          lessonId: lesson.id,
          estimatedMinutes: student.lessonMinutes,
        });
        added = true;
        break;
      }
      if (!added) break;
    }

    // ── Reading closes the day. ──
    // A short slot after the periods: read something, write a few sentences about it. The
    // passage is chosen when they open it, not now, so a day planned in advance still gives
    // them the next thing they have not read.
    const hasReading =
      slots.some((s) => s.kind === "READING") ||
      existing.some((a) => a.kind === "READING" && a.status !== "MOVED" && dateOnlyKey(a.date) === dayKey);
    if (!hasReading && (await prisma.readingText.count({ where: { yearGroup: student.yearGroup } })) > 0) {
      slots.push({ kind: "READING", estimatedMinutes: READING_MINUTES });
    }
  }

  const created: DailyAssignment[] = [];

  /**
   * Creates one assignment, tolerating the case where a concurrent request got there first.
   *
   * Partial unique indexes stop a day being planned twice (see the migration
   * `no_duplicate_assignments`). Losing that race is normal, not an error: the other request
   * created exactly the row we were about to, because planning is deterministic.
   */
  const createUnlessRaced = async (
    data: Parameters<typeof prisma.dailyAssignment.create>[0]["data"],
  ): Promise<DailyAssignment | null> => {
    try {
      return await prisma.dailyAssignment.create({ data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
      throw err;
    }
  };

  for (let i = 0; i < dayKeys.length; i++) {
    const dayKey = dayKeys[i];
    const dayDate = toDateOnly(dayKey);
    const slots = daySlots.get(dayKey)!;

    const existingForDay = existing.filter((a) => dateOnlyKey(a.date) === dayKey);
    let order = existingForDay.length > 0 ? Math.max(...existingForDay.map((a) => a.order)) + 1 : 0;

    for (const slot of slots) {
      if (slot.kind === "REVIEW") {
        const reviewItem = pendingReviewsById.get(slot.reviewItemId!);
        const row = await createUnlessRaced({
          studentId,
          date: dayDate,
          order: order++,
          kind: "REVIEW",
          source: "REVIEW_ENGINE",
          status: "PLANNED",
          reviewItemId: slot.reviewItemId,
          lessonId: reviewItem?.lessonId ?? null,
          estimatedMinutes: slot.estimatedMinutes,
        });
        if (row) {
          await prisma.reviewItem.update({
            where: { id: slot.reviewItemId! },
            data: { status: "SCHEDULED" },
          });
          created.push(row);
        }
      } else if (slot.kind === "READING") {
        const row = await createUnlessRaced({
          studentId,
          date: dayDate,
          order: order++,
          kind: "READING",
          source: "AUTO",
          status: "PLANNED",
          customTitle: "Reading",
          estimatedMinutes: slot.estimatedMinutes,
        });
        if (row) created.push(row);
      } else {
        const row = await createUnlessRaced({
          studentId,
          date: dayDate,
          order: order++,
          kind: "LESSON",
          source: "AUTO",
          status: slot.movedTo ? "MOVED" : "PLANNED",
          subjectId: slot.subjectId!,
          lessonId: slot.lessonId!,
          estimatedMinutes: slot.estimatedMinutes,
          optional: Boolean(slot.optional),
          movedToDate: slot.movedTo ? toDateOnly(slot.movedTo) : null,
        });
        if (row) created.push(row);
      }
    }
  }

  return prisma.dailyAssignment.findMany({
    where: { studentId, date: { in: dayDates } },
    orderBy: [{ date: "asc" }, { order: "asc" }],
  });
}

export async function ensureDayPlanned(studentId: string, dateKey: string): Promise<DailyAssignment[]> {
  if (isoWeekday(dateKey) > 5) return []; // weekends: plan nothing

  const dayDate = toDateOnly(dateKey);
  const existing = await prisma.dailyAssignment.findMany({ where: { studentId, date: dayDate }, orderBy: { order: "asc" } });
  if (existing.length > 0) return existing;

  await planWeek(studentId, dateKey);
  return prisma.dailyAssignment.findMany({ where: { studentId, date: dayDate }, orderBy: { order: "asc" } });
}

export async function getTodayView(studentId: string, dateKey: string): Promise<TodayView> {
  await ensureDayPlanned(studentId, dateKey);

  const dayDate = toDateOnly(dateKey);
  const full = await prisma.dailyAssignment.findMany({
    where: { studentId, date: dayDate },
    orderBy: { order: "asc" },
    include: {
      lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } },
      reviewItem: true,
    },
  });

  const lessonIds = full.map((a) => a.lessonId).filter((x): x is string => !!x);
  const progressRows = lessonIds.length
    ? await prisma.studentLessonProgress.findMany({ where: { studentId, lessonId: { in: lessonIds } } })
    : [];
  const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));

  const assignments = full.map((a) => ({ ...a, progress: a.lessonId ? progressByLesson.get(a.lessonId) ?? null : null }));

  const activeToday = full.filter((a) => a.status !== "MOVED");
  const totalMinutes = activeToday.reduce((sum, a) => sum + a.estimatedMinutes, 0);
  const completedToday = activeToday.filter((a) => a.status === "COMPLETED").length;
  const totalToday = activeToday.length;

  const monday = weekStartKey(dateKey);
  const weekDates = [0, 1, 2, 3, 4].map((i) => toDateOnly(addDaysKey(monday, i)));
  const weekAssignments = await prisma.dailyAssignment.findMany({ where: { studentId, date: { in: weekDates } } });
  const activeWeek = weekAssignments.filter((a) => a.status !== "MOVED");
  const completedWeek = activeWeek.filter((a) => a.status === "COMPLETED").length;
  const totalWeek = activeWeek.length;

  return { dateKey, assignments, totalMinutes, completedToday, totalToday, completedWeek, totalWeek };
}

export async function getWeekStrip(
  studentId: string,
  dateKey: string
): Promise<{ dateKey: string; state: "done" | "partial" | "planned" | "none" | "today" }[]> {
  const monday = weekStartKey(dateKey);
  const weekKeys = [0, 1, 2, 3, 4].map((i) => addDaysKey(monday, i));
  const weekDates = weekKeys.map(toDateOnly);
  const assignments = await prisma.dailyAssignment.findMany({ where: { studentId, date: { in: weekDates } } });
  const todayKey = dateOnlyKey(todayDateOnly());

  return weekKeys.map((key) => {
    if (key === todayKey) return { dateKey: key, state: "today" as const };

    const dayAssignments = assignments.filter((a) => dateOnlyKey(a.date) === key && a.status !== "MOVED");
    if (dayAssignments.length === 0) return { dateKey: key, state: "none" as const };

    const nonOptional = dayAssignments.filter((a) => !a.optional);
    const doneCount = nonOptional.filter((a) => a.status === "COMPLETED" || a.status === "SKIPPED").length;

    let state: "done" | "partial" | "planned";
    if (nonOptional.length > 0 && doneCount === nonOptional.length) state = "done";
    else if (doneCount > 0) state = "partial";
    else if (key > todayKey) state = "planned";
    else state = "partial";

    return { dateKey: key, state };
  });
}
