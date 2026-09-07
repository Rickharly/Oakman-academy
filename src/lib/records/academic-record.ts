/**
 * The cumulative academic record — the document a family hands to a school.
 *
 * This is deliberately **not** a transcript. No Canadian province issues transcripts for
 * home-educated children, and a homemade document that imitates one invites exactly the
 * scepticism it is trying to avoid. What a receiving principal can actually act on is
 * evidence: what was covered, against a named curriculum they can look up; what was assessed,
 * with real scores and dates; how much time was spent; and samples of the child's own work.
 *
 * So the record is built to be checkable rather than impressive:
 *
 * - Every number comes from the learning tables. Nothing here is estimated or rounded up.
 * - Coverage is stated against the English National Curriculum via the Oak programme the
 *   lessons came from, because that is a published framework, not our own invention.
 * - Work samples are quoted verbatim, including the weaker ones.
 * - The teacher's notes say plainly that they were written by an AI teacher and reviewed by a
 *   parent. A principal who discovers that for themselves stops believing the rest of the page.
 */
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai/provider";
import { dateOnlyKey, schoolDayEnd, schoolDayStart } from "@/lib/dates";

export type RecordUnit = {
  title: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  lessonTitles: string[];
};

export type RecordAssessment = {
  date: string;
  lesson: string;
  scorePct: number;
  attempts: number;
};

export type RecordSubject = {
  subjectTitle: string;
  framework: string;
  units: RecordUnit[];
  lessonsCompleted: number;
  averageAssessmentPct: number | null;
  masteryPct: number | null;
  assessments: RecordAssessment[];
  strongest: string[];
  needsWork: string[];
  note: string | null;
};

export type RecordWritingSample = {
  date: string;
  title: string;
  prompt: string;
  response: string;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
};

export type AcademicRecord = {
  student: { name: string; yearGroup: number; keyStage: string };
  generatedAt: Date;
  periodStart: string | null;
  periodEnd: string | null;
  totals: {
    lessonsCompleted: number;
    questionsAnswered: number;
    instructionalHours: number;
    daysAttended: number;
    averageAssessmentPct: number | null;
  };
  attendance: {
    daysAttended: number;
    onTimeStarts: number;
    lateStarts: number;
    averageStartTime: string | null;
    focusPct: number | null;
  };
  subjects: RecordSubject[];
  writing: RecordWritingSample[];
  provenance: string;
};

export const PROVENANCE =
  "This record was produced by Oakman Academy, a home-education programme run by the child's " +
  "parents. Lessons follow the English National Curriculum through Oak National Academy. " +
  "All figures are drawn directly from the child's completed work: scores are as marked at the " +
  "time and have not been adjusted. Quizzes are marked automatically; extended writing is " +
  "marked by an AI teacher and reviewed by a parent. The subject notes below were written by " +
  "that AI teacher from the child's actual work, and are labelled as such rather than presented " +
  "as the observations of a qualified teacher. Work samples are reproduced verbatim, including " +
  "weaker ones.";

const noteSchema = z.object({
  note: z.string(),
  strongest: z.array(z.string()),
  needsWork: z.array(z.string()),
});

function pct(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value * 100);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Builds the record from everything stored for a student.
 *
 * `withNotes` asks the AI teacher for a paragraph per subject. It is off by default so the
 * page can render instantly and the notes generated deliberately, and because a document that
 * silently changes its wording every time it is opened is not a record.
 */
export async function buildAcademicRecord(
  studentId: string,
  opts: { withNotes?: boolean } = {},
): Promise<AcademicRecord> {
  const student = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    include: { user: true },
  });

  const progress = await prisma.studentLessonProgress.findMany({
    where: { studentId },
    include: {
      lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } },
    },
    orderBy: { completedAt: "asc" },
  });

  const worked = progress.filter((p) => p.status === "COMPLETED" || p.status === "MASTERED");

  // ── Attendance, from the days that were actually worked ──
  const days = await prisma.schoolDay.findMany({
    where: { studentId, startedAt: { not: null } },
    orderBy: { date: "asc" },
  });
  const attempts = await prisma.lessonAttempt.findMany({
    where: { studentId },
    select: { activeSeconds: true, idleSeconds: true, timeSpentSeconds: true, startedLateSeconds: true },
  });

  const activeSeconds = attempts.reduce((n, a) => n + a.activeSeconds, 0);
  const idleSeconds = attempts.reduce((n, a) => n + a.idleSeconds, 0);
  const totalSeconds = attempts.reduce((n, a) => n + a.timeSpentSeconds, 0);
  const rated = attempts.filter((a) => a.startedLateSeconds != null);
  const onTime = rated.filter((a) => (a.startedLateSeconds ?? 0) < 5 * 60).length;

  const startTimes = days
    .map((d) => d.startedAt)
    .filter((d): d is Date => d !== null)
    .map((d) => d.getUTCHours() * 60 + d.getUTCMinutes());
  const averageStart = mean(startTimes);

  // ── Subjects ──
  const bySubject = new Map<string, typeof progress>();
  for (const row of progress) {
    const key = row.lesson.unit.programme.subject.id;
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key)!.push(row);
  }

  const subjects: RecordSubject[] = [];
  for (const rows of bySubject.values()) {
    const subject = rows[0].lesson.unit.programme.subject;
    const programme = rows[0].lesson.unit.programme;
    const done = rows.filter((r) => r.status === "COMPLETED" || r.status === "MASTERED");

    const byUnit = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.lesson.unit.id;
      if (!byUnit.has(key)) byUnit.set(key, []);
      byUnit.get(key)!.push(row);
    }

    const units: RecordUnit[] = [...byUnit.values()]
      .map((unitRows) => ({
        title: unitRows[0].lesson.unit.title,
        lessonsTotal: unitRows.length,
        lessonsCompleted: unitRows.filter((r) => r.status === "COMPLETED" || r.status === "MASTERED").length,
        lessonTitles: unitRows
          .filter((r) => r.status === "COMPLETED" || r.status === "MASTERED")
          .map((r) => r.lesson.title),
      }))
      .filter((u) => u.lessonsCompleted > 0);

    const scores = done.map((r) => r.bestScorePct).filter((s): s is number => s != null);
    const masteries = done.map((r) => r.mastery).filter((m): m is number => m != null);

    subjects.push({
      subjectTitle: subject.title,
      framework: `English National Curriculum · ${programme.keyStage.toUpperCase()} · Year ${programme.yearGroup}`,
      units,
      lessonsCompleted: done.length,
      averageAssessmentPct: scores.length ? Math.round(mean(scores)!) : null,
      masteryPct: masteries.length ? pct(mean(masteries)) : null,
      assessments: done
        .filter((r) => r.bestScorePct != null && r.completedAt)
        .map((r) => ({
          date: dateOnlyKey(r.completedAt!),
          lesson: r.lesson.title,
          scorePct: Math.round(r.bestScorePct!),
          attempts: r.attempts,
        })),
      strongest: done
        .filter((r) => (r.mastery ?? 0) >= 0.8)
        .slice(0, 5)
        .map((r) => r.lesson.title),
      needsWork: rows
        .filter((r) => r.needsReview || (r.mastery != null && r.mastery < 0.6))
        .slice(0, 5)
        .map((r) => r.lesson.title),
      note: null,
    });
  }
  // A subject with nothing finished has nothing to report. Listing it with a zero reads as
  // padding and invites the reader to discount the sections that do have substance.
  const covered = subjects.filter((s) => s.lessonsCompleted > 0);
  covered.sort((a, b) => b.lessonsCompleted - a.lessonsCompleted);

  // ── Work samples: their own writing, the weaker ones included ──
  const entries = await prisma.readingEntry.findMany({
    where: { studentId },
    include: { readingText: { select: { title: true } } },
    orderBy: { submittedAt: "desc" },
    take: 12,
  });

  const writing: RecordWritingSample[] = entries.map((e) => ({
    date: dateOnlyKey(e.submittedAt),
    title: e.readingText.title,
    prompt: e.prompt,
    response: e.response,
    score: e.score,
    maxScore: e.maxScore,
    feedback: e.feedback,
  }));

  const questionsAnswered = await prisma.questionAttempt.count({ where: { studentId } });
  const allScores = worked.map((p) => p.bestScorePct).filter((s): s is number => s != null);

  const record: AcademicRecord = {
    student: {
      name: student.user.displayName,
      yearGroup: student.yearGroup,
      keyStage: student.keyStage.toUpperCase(),
    },
    generatedAt: new Date(),
    periodStart: days.length ? dateOnlyKey(days[0].date) : null,
    periodEnd: days.length ? dateOnlyKey(days[days.length - 1].date) : null,
    totals: {
      lessonsCompleted: worked.length,
      questionsAnswered,
      instructionalHours: Math.round((totalSeconds / 3600) * 10) / 10,
      daysAttended: days.length,
      averageAssessmentPct: allScores.length ? Math.round(mean(allScores)!) : null,
    },
    attendance: {
      daysAttended: days.length,
      onTimeStarts: onTime,
      lateStarts: rated.length - onTime,
      averageStartTime:
        averageStart == null
          ? null
          : `${String(Math.floor(averageStart / 60)).padStart(2, "0")}:${String(Math.round(averageStart % 60)).padStart(2, "0")}`,
      focusPct:
        activeSeconds + idleSeconds > 0
          ? Math.round((activeSeconds / (activeSeconds + idleSeconds)) * 100)
          : null,
    },
    subjects: covered,
    writing,
    provenance: PROVENANCE,
  };

  if (opts.withNotes) {
    await addTeacherNotes(record);
  }

  return record;
}

/**
 * Asks the AI teacher for a paragraph on each subject.
 *
 * The prompt forbids inventing anything and requires the note to be specific enough that a
 * stranger could tell it was written about this child. A generic "has made good progress"
 * paragraph is worse than no paragraph: it reads as filler and devalues the page around it.
 */
async function addTeacherNotes(record: AcademicRecord): Promise<void> {
  const ai = getAiProvider();

  for (const subject of record.subjects) {
    const system = [
      `You are an experienced teacher writing the ${subject.subjectTitle} section of a school`,
      `report for ${record.student.name}, a Year ${record.student.yearGroup} child. It will be read`,
      "by a school considering where to place them.",
      "",
      "Write the way a real teacher writes at the end of term: warm, specific, and honest about",
      "what is not yet secure. Name actual topics from the list you are given. Never invent a",
      "detail, a piece of work, or a conversation that is not in the data.",
      "",
      "note: 60–100 words, third person, UK English. No score summaries — the numbers are printed",
      "beside it. Say what they can do and what comes next.",
      "strongest: up to 3 short topic phrases, drawn only from the lessons listed.",
      "needsWork: up to 3 short topic phrases. Empty if nothing genuinely needs work.",
      "",
      "Do not write 'has made good progress' or any sentence that would fit any child.",
    ].join("\n");

    const content = [
      `Lessons completed: ${subject.lessonsCompleted}`,
      `Average assessment: ${subject.averageAssessmentPct ?? "not assessed"}%`,
      `Average mastery: ${subject.masteryPct ?? "not measured"}%`,
      "",
      `Units and lessons covered:`,
      ...subject.units.map((u) => `- ${u.title}: ${u.lessonTitles.join("; ")}`),
      "",
      `Secure: ${subject.strongest.join("; ") || "none flagged"}`,
      `Not yet secure: ${subject.needsWork.join("; ") || "none flagged"}`,
    ].join("\n");

    try {
      const { data } = await ai.structured({
        model: "strong",
        schemaName: "subjectReportNote",
        schema: noteSchema,
        system,
        messages: [{ role: "user", content }],
      });
      subject.note = data.note;
      if (data.strongest.length) subject.strongest = data.strongest;
      if (data.needsWork.length) subject.needsWork = data.needsWork;
    } catch {
      // A record with numbers and no prose is still a usable record.
    }
  }
}

/** Saves the record so the exact document handed to a school can be reproduced later. */
export async function saveAcademicRecord(studentId: string, record: AcademicRecord) {
  return prisma.report.create({
    data: {
      studentId,
      period: "ACADEMIC_RECORD",
      periodStart: schoolDayStart(record.periodStart ?? dateOnlyKey(new Date())),
      periodEnd: schoolDayEnd(record.periodEnd ?? dateOnlyKey(new Date())),
      data: JSON.parse(JSON.stringify(record)),
      teacherSummary: record.subjects.map((s) => s.note).filter(Boolean).join("\n\n") || null,
    },
  });
}
