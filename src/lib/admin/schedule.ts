/**
 * Admin scheduling controls (spec §28-31; ARCHITECTURE §7; docs/CONTRACTS.md). These sit
 * above `scheduling/planner.ts`: they let a parent set the weekly-frequency rules the planner
 * reads, and hand-adjust individual `DailyAssignment` rows the planner already produced. Every
 * function here takes a `studentId` the caller has already verified belongs to this parent
 * (`requireParentOfStudent`); nothing here re-checks the parent/student link itself.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { DailyAssignment } from "@/generated/prisma/client";
import { ApiError } from "@/lib/auth/api";
import { toDateOnly } from "@/lib/dates";

export interface ScheduleRuleInput {
  subjectId: string;
  weeklyFrequency: number;
  preferredDays: number[];
  priority?: number;
}

/** Replaces the student's weekly-frequency rules with exactly the given set (per subject). */
export async function upsertSchedule(studentId: string, rules: ScheduleRuleInput[]): Promise<void> {
  const keep = new Set(rules.map((r) => r.subjectId));

  await prisma.$transaction([
    ...rules.map((rule) =>
      prisma.studentSchedule.upsert({
        where: { studentId_subjectId: { studentId, subjectId: rule.subjectId } },
        create: {
          studentId,
          subjectId: rule.subjectId,
          weeklyFrequency: rule.weeklyFrequency,
          preferredDays: rule.preferredDays,
          priority: rule.priority ?? 0,
          // A subject set to 0 a week is off the timetable. Saving it as active put every
          // subject in the database on the child's rota: the overview then warned that
          // subjects they were never meant to take had "nothing to teach", and the planner
          // used them to fill short days.
          active: rule.weeklyFrequency > 0,
        },
        update: {
          weeklyFrequency: rule.weeklyFrequency,
          preferredDays: rule.preferredDays,
          priority: rule.priority ?? 0,
          active: rule.weeklyFrequency > 0,
        },
      })
    ),
  ]);

  // Deactivate any existing rule for a subject that is no longer in the submitted set,
  // rather than deleting it (keeps the row, and its history, around).
  await prisma.studentSchedule.updateMany({
    where: { studentId, subjectId: { notIn: [...keep] }, active: true },
    data: { active: false },
  });
}

/**
 * A lesson is on a day once.
 *
 * The database enforces it (one non-moved LESSON row per student, day and lesson), and used to
 * enforce it with a bare "Internal server error" under the board — the "Repeat today" button
 * hit it every single time, because repeating today's lesson today is exactly the duplicate
 * the rule forbids. Said in words instead, and repeats go to the next school day.
 */
function isDuplicateAssignment(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function alreadyOnDay(studentId: string, date: Date, lessonId: string): Promise<boolean> {
  const clash = await prisma.dailyAssignment.findFirst({
    where: { studentId, date, lessonId, kind: "LESSON", status: { not: "MOVED" } },
    select: { id: true },
  });
  return clash !== null;
}

function describeDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

async function nextOrderForDay(studentId: string, date: Date): Promise<number> {
  const existing = await prisma.dailyAssignment.findMany({ where: { studentId, date }, select: { order: true } });
  return existing.length > 0 ? Math.max(...existing.map((a) => a.order)) + 1 : 0;
}

export interface AddCustomAssignmentInput {
  studentId: string;
  dateKey: string;
  title: string;
  instructions?: string;
  estimatedMinutes?: number;
  lessonId?: string;
}

export async function addCustomAssignment(parentId: string, input: AddCustomAssignmentInput): Promise<DailyAssignment> {
  const date = toDateOnly(input.dateKey);
  const order = await nextOrderForDay(input.studentId, date);

  let subjectId: string | null = null;
  let estimatedMinutes = input.estimatedMinutes ?? 45;
  if (input.lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: input.lessonId },
      include: { unit: { include: { programme: true } } },
    });
    if (!lesson) throw new ApiError(404, "Lesson not found");
    subjectId = lesson.unit.programme.subjectId;
    if (!input.estimatedMinutes) estimatedMinutes = lesson.estimatedMinutes;
    if (await alreadyOnDay(input.studentId, date, lesson.id)) {
      throw new ApiError(409, `"${lesson.title}" is already on ${describeDay(date)}.`);
    }
  }

  return prisma.dailyAssignment.create({
    data: {
      studentId: input.studentId,
      date,
      order,
      kind: input.lessonId ? "LESSON" : "CUSTOM",
      source: "PARENT",
      status: "PLANNED",
      subjectId,
      lessonId: input.lessonId ?? null,
      customTitle: input.title,
      customInstructions: input.instructions ?? null,
      estimatedMinutes,
      createdById: parentId,
    },
  });
}

export async function moveAssignment(assignmentId: string, toDateKey: string): Promise<DailyAssignment> {
  const assignment = await prisma.dailyAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new ApiError(404, "Assignment not found");
  if (assignment.status === "COMPLETED") throw new ApiError(400, "Cannot move a completed assignment");

  const date = toDateOnly(toDateKey);
  if (assignment.kind === "LESSON" && assignment.lessonId && (await alreadyOnDay(assignment.studentId, date, assignment.lessonId))) {
    throw new ApiError(409, `That lesson is already on ${describeDay(date)}.`);
  }
  const order = await nextOrderForDay(assignment.studentId, date);

  try {
    return await prisma.dailyAssignment.update({
      where: { id: assignmentId },
      data: {
        date,
        order,
        status: assignment.status === "MOVED" ? "PLANNED" : assignment.status,
        movedToDate: null,
      },
    });
  } catch (err) {
    if (isDuplicateAssignment(err)) throw new ApiError(409, `That is already on ${describeDay(date)}.`);
    throw err;
  }
}

export async function skipAssignment(assignmentId: string): Promise<DailyAssignment> {
  const assignment = await prisma.dailyAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new ApiError(404, "Assignment not found");
  if (assignment.status === "COMPLETED") throw new ApiError(400, "Cannot skip a completed assignment");

  return prisma.dailyAssignment.update({ where: { id: assignmentId }, data: { status: "SKIPPED" } });
}

export async function repeatLesson(
  parentId: string,
  studentId: string,
  lessonId: string,
  dateKey: string
): Promise<DailyAssignment> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: { include: { programme: true } } },
  });
  if (!lesson) throw new ApiError(404, "Lesson not found");

  const date = toDateOnly(dateKey);
  if (await alreadyOnDay(studentId, date, lesson.id)) {
    throw new ApiError(409, `"${lesson.title}" is already on ${describeDay(date)}. Pick another day to repeat it.`);
  }
  const order = await nextOrderForDay(studentId, date);

  try {
    return await prisma.dailyAssignment.create({
      data: {
        studentId,
        date,
        order,
        kind: "LESSON",
        source: "PARENT",
        status: "PLANNED",
        subjectId: lesson.unit.programme.subjectId,
        lessonId: lesson.id,
        estimatedMinutes: lesson.estimatedMinutes,
        createdById: parentId,
      },
    });
  } catch (err) {
    if (isDuplicateAssignment(err)) throw new ApiError(409, `"${lesson.title}" is already on ${describeDay(date)}.`);
    throw err;
  }
}
