/**
 * Weekly scheduler (spec §28–§30; ARCHITECTURE §7). Deterministic given the
 * same DB state: same inputs → same plan, so re-planning is stable and safe
 * to call repeatedly.
 */
import { prisma } from "@/lib/db";
import type { DailyAssignment, Lesson, Programme, ReviewItem, StudentLessonProgress, Subject, Unit } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { addDaysKey, dateOnlyKey, isoWeekday, schoolDayEnd, todayDateOnly, toDateOnly, weekStartKey } from "@/lib/dates";
import { enrolStudentInYearGroup, fixYearGroupEnrolments } from "@/lib/admin/enrol";
import { settleFinishedLessons } from "@/lib/lessons/service";
import { catchUpImport } from "@/lib/curriculum/autofill";

const REVIEW_MINUTES = 15;
/**
 * One, not two.
 *
 * A review is a quarter-hour of revisiting old work. Two of them alongside a short day turned a
 * child's board into a list of reviews with a lesson hidden among them, which is not a school
 * day — it is what a school day looks like when the app has run out of things to teach and is
 * covering for itself.
 */
const MAX_REVIEWS_PER_DAY = 1;
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

  const readSchedules = () =>
    prisma.studentSchedule.findMany({
      where: { studentId, active: true },
      orderBy: [{ priority: "desc" }, { weeklyFrequency: "desc" }],
    });
  let schedules = await readSchedules();

  let enrolments = await prisma.studentEnrolment.findMany({ where: { studentId, active: true } });

  // A student added through Settings used to get an account and nothing else, so they opened
  // Today to an empty page. Enrol them on their year group's subjects the first time anything
  // tries to plan for them, so an existing account repairs itself rather than staying broken.
  if (enrolments.length === 0) {
    await enrolStudentInYearGroup(studentId).catch(() => undefined);
    enrolments = await prisma.studentEnrolment.findMany({ where: { studentId, active: true } });
    schedules = await readSchedules();
  }
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
      /**
       * Reviews already on the day count.
       *
       * This only counted the ones this run had just added, so every visit to Today added the
       * limit again on top of whatever was already there. Eva's board reached eleven reviews
       * that way — the same page load, repeated, each time believing the day had none.
       */
      const reviewsToday =
        daySlots.get(dayKey)!.filter((s) => s.kind === "REVIEW").length +
        existing.filter(
          (a) => a.kind === "REVIEW" && a.status !== "MOVED" && dateOnlyKey(a.date) === dayKey,
        ).length;
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
    const existingToday = existing.filter(
      (a) => a.kind === "LESSON" && a.status !== "MOVED" && dateOnlyKey(a.date) === dayKey,
    );
    const existingLessonCount = existingToday.length;

    /**
     * Which subjects this day already has — including the ones already saved.
     *
     * Reading only the new slots is how a child ended up with three maths lessons in a day: a
     * top-up ran, could not see the maths lesson already on the board, and cheerfully added
     * another. A day is planned against what is actually on it, not against what this pass
     * happens to have put there.
     */
    const subjectsToday = () =>
      new Set([
        ...existingToday.map((a) => a.subjectId).filter((id): id is string => Boolean(id)),
        ...slots.filter((s) => s.kind === "LESSON").map((s) => s.subjectId),
      ]);

    let guard = 0;
    while (slots.filter((s) => s.kind === "LESSON").length + existingLessonCount < lessonsPerDay) {
      if (guard++ > rotation.length * 3) break; // every subject is out of lessons

      // One period per subject per day, full stop.
      //
      // This used to prefer an unused subject and then fall back to doubling up, which meant a
      // week where only maths and English had lessons imported produced days of three maths and
      // two English. That is not a school day and it is not good teaching: a nine-year-old
      // doing four periods of the same subject learns less than one doing two, and the child
      // reasonably asks what is going on. When there are not enough subjects to fill the
      // timetable the day is simply shorter, and their page says why.
      const taken = subjectsToday();
      const available = rotation.filter((id) => !taken.has(id));

      let added = false;
      for (const subjectId of available) {
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

/**
 * Makes sure the day in front of a child is a full timetable.
 *
 * The test is "does this day have its periods", not "does this day have anything". Those are
 * not the same, and treating them as the same left a child looking at a single lesson with no
 * way back: any row at all — a lone reading slot, a day left short by a half-finished plan —
 * stopped the planner from ever running again for that day.
 *
 * Topping up is safe to call repeatedly. `planWeek` only adds what is missing, never touches
 * work already started or set by a parent, and the database refuses a duplicate.
 */
/**
 * The exact note the short-day filler wrote on every review it created.
 *
 * That filler was a bad idea — it padded a thin day with revision instead of fixing why the day
 * was thin — and it left behind a pile of review items that are still being scheduled. They are
 * identifiable by this text, and they are removed rather than left to clutter a child's board
 * with "quick review" where lessons should be.
 */
const FILLER_REVIEW_DETAIL = "Coming back to this to keep it fresh.";

/** Removes the short-day filler's leftovers. Runs once per day view; cheap and idempotent. */
async function purgeFillerReviews(studentId: string): Promise<void> {
  const items = await prisma.reviewItem.findMany({
    where: { studentId, reason: "SPACED", detail: FILLER_REVIEW_DETAIL, status: { not: "DISMISSED" } },
    select: { id: true },
  });
  if (items.length === 0) return;
  const ids = items.map((i) => i.id);

  // Only ones nobody has started. Work a child actually did is history and stays.
  await prisma.dailyAssignment.deleteMany({
    where: { studentId, kind: "REVIEW", status: "PLANNED", reviewItemId: { in: ids } },
  });
  await prisma.reviewItem.updateMany({ where: { id: { in: ids } }, data: { status: "DISMISSED" } });
}

export async function ensureDayPlanned(studentId: string, dateKey: string): Promise<DailyAssignment[]> {
  if (isoWeekday(dateKey) > 5) return []; // weekends: plan nothing

  await purgeFillerReviews(studentId).catch(() => undefined);
  // A child enrolled on the wrong year is taught the wrong curriculum every day until someone
  // notices. Cheap to check, and it repairs itself rather than waiting to be reported again.
  await fixYearGroupEnrolments(studentId).catch(() => undefined);

  const dayDate = toDateOnly(dateKey);
  const read = () =>
    prisma.dailyAssignment.findMany({ where: { studentId, date: dayDate }, orderBy: { order: "asc" } });

  const existing = await read();
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) return existing;

  // Repair first, always.
  //
  // A day that is already the right length can still be the wrong day: five periods made of
  // three maths and two English counts as full, so checking the length first meant days like
  // that were never looked at again. Trimming runs unconditionally now, and it removes repeated
  // subjects as well as surplus periods.
  await trimDayToTimetable(studentId, dayDate, student.lessonsPerDay);
  const afterTrim = await read();

  /**
   * Lessons, and only lessons.
   *
   * This briefly counted reviews as periods too, to stop a day filled with revision being topped
   * up on every visit. The effect was catastrophic and immediate: a child whose board held five
   * reviews counted as having a full day, so planning never ran and no lesson was ever added.
   * The board stayed nothing but "quick review", permanently. A review sits alongside the
   * timetable; it is not a period of it, and it can never stand in for one.
   */
  const lessonsToday = afterTrim.filter((a) => a.kind === "LESSON" && a.status !== "MOVED").length;
  if (lessonsToday >= student.lessonsPerDay) return afterTrim;

  await planWeek(studentId, dateKey);
  await trimDayToTimetable(studentId, dayDate, student.lessonsPerDay);
  const planned = await read();

  // Still short after planning? Then a subject has run out of lessons, and a child is looking
  // at the gap right now. Go and get them — without blocking this page, and without a parent
  // having to notice and press anything.
  // New material specifically: a day propped up with revision still needs its real lessons.
  const lessonsPlanned = planned.filter((a) => a.kind === "LESSON" && a.status !== "MOVED").length;
  if (lessonsPlanned < student.lessonsPerDay) void catchUpImport(studentId).catch(() => undefined);

  return planned;
}

/**
 * Cuts a day back to the number of periods the timetable promises.
 *
 * The earliest-created periods are kept, so a child sees the same day they saw a minute ago.
 * Only PLANNED lessons are removed: work already started or finished is a child's own and is
 * never deleted, even when that leaves the day long.
 */
async function trimDayToTimetable(studentId: string, dayDate: Date, cap: number): Promise<void> {
  const lessons = await prisma.dailyAssignment.findMany({
    where: { studentId, date: dayDate, kind: "LESSON", status: { not: "MOVED" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  /**
   * A day with three maths lessons on it, repaired.
   *
   * The planner used to double up a subject when the others had nothing to give, so days were
   * saved with three maths and two English. Three periods of the same subject is not a school
   * day and it is not good teaching — a child does less well in the third than they would in a
   * first period of something else — so the extras go, oldest kept. Only untouched ones: work
   * already started or finished is history and is never deleted.
   */
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const lesson of lessons) {
    if (!lesson.subjectId) continue;
    if (seen.has(lesson.subjectId)) {
      if (lesson.status === "PLANNED") duplicates.push(lesson.id);
      continue;
    }
    seen.add(lesson.subjectId);
  }
  if (duplicates.length > 0) {
    await prisma.dailyAssignment.deleteMany({ where: { id: { in: duplicates } } });
  }

  /**
   * The same lesson reviewed twice in one day.
   *
   * Review items come from several places — a low score, a misconception, a parked gap — and
   * nothing stopped two of them for the same lesson landing on the same day. To a child that is
   * the same thing twice, which reads as the app being broken, and it is.
   */
  const reviews = await prisma.dailyAssignment.findMany({
    where: { studentId, date: dayDate, kind: "REVIEW", status: { not: "MOVED" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const seenReviewLessons = new Set<string>();
  const duplicateReviews: string[] = [];
  for (const review of reviews) {
    const key = review.lessonId ?? review.id;
    if (seenReviewLessons.has(key)) {
      if (review.status === "PLANNED") duplicateReviews.push(review.id);
      continue;
    }
    seenReviewLessons.add(key);
  }
  if (duplicateReviews.length > 0) {
    await prisma.dailyAssignment.deleteMany({ where: { id: { in: duplicateReviews } } });
  }

  // And cap what is left. A day that has collected eleven reviews needs cutting back to one,
  // not just de-duplicating — the ones nobody has started, keeping the oldest.
  const keptReviews = reviews.filter((r) => !duplicateReviews.includes(r.id));
  const surplusReviews = keptReviews.slice(MAX_REVIEWS_PER_DAY).filter((r) => r.status === "PLANNED");
  if (surplusReviews.length > 0) {
    await prisma.dailyAssignment.deleteMany({ where: { id: { in: surplusReviews.map((r) => r.id) } } });
  }

  const remaining = lessons.filter((a) => !duplicates.includes(a.id));
  if (remaining.length <= cap) return;

  const surplus = remaining.slice(cap).filter((a) => a.status === "PLANNED");
  if (surplus.length === 0) return;

  await prisma.dailyAssignment.deleteMany({ where: { id: { in: surplus.map((a) => a.id) } } });
}

export async function getTodayView(studentId: string, dateKey: string): Promise<TodayView> {
  await ensureDayPlanned(studentId, dateKey);

  // A lesson someone actually did should be on the board as done, whether or not they pressed
  // the button that says so. Never fatal — the board renders either way.
  await settleFinishedLessons(studentId).catch(() => undefined);

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
