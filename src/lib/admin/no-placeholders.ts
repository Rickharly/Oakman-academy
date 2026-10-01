/**
 * Getting the sample curriculum out of a real school.
 *
 * The bundled placeholder curriculum exists so a fresh install has something on the screen. Its
 * lessons are invented, its "videos" are `fixture://` addresses pointing at nothing, and its
 * quizzes test material no teacher wrote. A child on it is doing made-up work in front of a
 * black video player — which is exactly what was happening for days while the reports said the
 * video was broken.
 *
 * Every guard so far has been a preference: enrol on Oak *where Oak exists*. A preference fails
 * the moment an enrolment is wrong in a way nobody predicted, and it has failed that way twice.
 * This is the sweep that removes it, and the report that proves it is gone.
 *
 * One honest exception, and it is not a placeholder. Oak has no curriculum for Writing as a
 * craft or for Logic, and the family asked for both. Those lessons are written here and stamped
 * `oakman` — real material for subjects the provider does not carry, which is a different thing
 * from the sample data and is reported separately so nobody has to take my word for which is
 * which.
 */
import { prisma } from "@/lib/db";
import { PLACEHOLDER_PROVIDER } from "./enrol";
import { GENERATED_PROVIDER } from "@/lib/curriculum/generate";
import { todayDateOnly } from "@/lib/dates";

export interface PlaceholderSweep {
  /** Future assignments pointing at invented lessons, removed. */
  assignmentsRemoved: number;
  /** Enrolments on the sample curriculum, deactivated. */
  enrolmentsDeactivated: number;
  /** Timetable lines pointing at a sample subject row, deactivated. */
  schedulesDeactivated: number;
  /** Subjects left with nothing real to teach, which is a gap a parent needs to know about. */
  subjectsLeftEmpty: string[];
}

/**
 * Takes the placeholder curriculum off this child.
 *
 * Only ever removes work nobody has started: a lesson they actually sat, even an invented one,
 * is still an hour of their life and their record is not ours to rewrite. Safe to run again.
 */
export async function sweepPlaceholders(studentId: string): Promise<PlaceholderSweep> {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) {
    return {
      assignmentsRemoved: 0,
      enrolmentsDeactivated: 0,
      schedulesDeactivated: 0,
      subjectsLeftEmpty: [],
    };
  }

  // 1. Work not yet begun, pointing at an invented lesson.
  const planned = await prisma.dailyAssignment.findMany({
    where: {
      studentId,
      status: { in: ["PLANNED", "IN_PROGRESS"] },
      lesson: { provider: PLACEHOLDER_PROVIDER },
    },
    select: { id: true, status: true },
  });
  // IN_PROGRESS counts as begun only if they actually answered something; an assignment flips to
  // IN_PROGRESS the moment a lesson is opened, which is not the same as work done.
  const untouched: string[] = [];
  for (const assignment of planned) {
    const answered = await prisma.questionAttempt.count({
      where: { studentId, activityAttempt: { lessonAttempt: { assignmentId: assignment.id } } },
    });
    if (answered === 0) untouched.push(assignment.id);
  }
  if (untouched.length > 0) {
    await prisma.dailyAssignment.deleteMany({ where: { id: { in: untouched } } });
  }

  // 2. Enrolments on it.
  const placeholderEnrolments = await prisma.studentEnrolment.findMany({
    where: { studentId, active: true, programme: { provider: PLACEHOLDER_PROVIDER } },
    include: { programme: { include: { subject: true } } },
  });
  if (placeholderEnrolments.length > 0) {
    await prisma.studentEnrolment.updateMany({
      where: { id: { in: placeholderEnrolments.map((e) => e.id) } },
      data: { active: false },
    });
  }

  // 3. Timetable lines pointing at a sample subject row. The subject is still taught — the row
  //    is just the wrong one, and `alignSchedulesToEnrolments` moves it once the enrolment is
  //    right. Deactivating a line whose slug has nowhere else to go would silently drop the
  //    subject, so those are reported instead.
  const schedules = await prisma.studentSchedule.findMany({
    where: { studentId, active: true, subject: { provider: PLACEHOLDER_PROVIDER } },
    include: { subject: true },
  });

  let schedulesDeactivated = 0;
  const subjectsLeftEmpty: string[] = [];

  for (const schedule of schedules) {
    const realSubject = await prisma.subject.findFirst({
      where: { slug: schedule.subject.slug, provider: { not: PLACEHOLDER_PROVIDER } },
    });
    if (!realSubject) {
      subjectsLeftEmpty.push(schedule.subject.title);
      continue;
    }
    const occupied = await prisma.studentSchedule.findFirst({
      where: { studentId, subjectId: realSubject.id },
    });
    if (occupied) {
      await prisma.studentSchedule.update({ where: { id: schedule.id }, data: { active: false } });
      schedulesDeactivated += 1;
    } else {
      await prisma.studentSchedule.update({
        where: { id: schedule.id },
        data: { subjectId: realSubject.id },
      });
    }
  }

  // 4. Subjects on the timetable with no real material at all behind them.
  const active = await prisma.studentSchedule.findMany({
    where: { studentId, active: true },
    include: { subject: true },
  });
  for (const schedule of active) {
    const real = await prisma.lesson.count({
      where: {
        provider: { not: PLACEHOLDER_PROVIDER },
        unit: {
          programme: {
            yearGroup: student.yearGroup,
            subject: { slug: schedule.subject.slug },
          },
        },
      },
    });
    if (real === 0 && !subjectsLeftEmpty.includes(schedule.subject.title)) {
      subjectsLeftEmpty.push(schedule.subject.title);
    }
  }

  return {
    assignmentsRemoved: untouched.length,
    enrolmentsDeactivated: placeholderEnrolments.length,
    schedulesDeactivated,
    subjectsLeftEmpty,
  };
}

export interface ProvenanceLine {
  studentName: string;
  /** One line per lesson on today's board. */
  today: { title: string; subject: string; provider: string }[];
  /** One line per programme they are enrolled on. */
  programmes: { subject: string; provider: string; yearGroup: number; lessons: number }[];
}

/**
 * Where every lesson in front of these children actually came from.
 *
 * The question "are they on real material?" has been answered by inference three times and
 * wrongly twice. This answers it by naming the provider of every lesson on every board.
 */
export async function lessonProvenance(): Promise<ProvenanceLine[]> {
  const students = await prisma.studentProfile.findMany({
    include: { user: { select: { displayName: true } } },
    orderBy: { yearGroup: "asc" },
  });

  const lines: ProvenanceLine[] = [];
  for (const student of students) {
    const assignments = await prisma.dailyAssignment.findMany({
      where: { studentId: student.id, date: todayDateOnly(), kind: "LESSON", status: { not: "MOVED" } },
      include: {
        lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } },
      },
      orderBy: { order: "asc" },
    });

    const enrolments = await prisma.studentEnrolment.findMany({
      where: { studentId: student.id, active: true },
      include: { programme: { include: { subject: true } } },
    });

    const programmes = [];
    for (const enrolment of enrolments) {
      const lessons = await prisma.lesson.count({
        where: { unit: { programmeId: enrolment.programmeId } },
      });
      programmes.push({
        subject: enrolment.programme.subject.title,
        provider: enrolment.programme.provider,
        yearGroup: enrolment.programme.yearGroup,
        lessons,
      });
    }

    lines.push({
      studentName: student.user.displayName,
      today: assignments
        .filter((a) => a.lesson)
        .map((a) => ({
          title: a.lesson!.title,
          subject: a.lesson!.unit.programme.subject.title,
          provider: a.lesson!.provider,
        })),
      programmes,
    });
  }

  return lines;
}

/** True for a provider that is real teaching material rather than the bundled sample. */
export function isRealMaterial(provider: string): boolean {
  return provider !== PLACEHOLDER_PROVIDER;
}

/** True for material written here because the provider carries none — Writing, Logic. */
export function isWrittenHere(provider: string): boolean {
  return provider === GENERATED_PROVIDER;
}
