/**
 * Weekly/monthly reports and the AI daily summary (spec §32-38; ARCHITECTURE §8;
 * docs/CONTRACTS.md). Stats are always computed deterministically from the learning
 * tables first and saved; the AI narrative (`teacherSummary` / `DailySummary.content`)
 * is best-effort on top — a report or summary must still save when the AI is
 * unavailable (mock provider without a fixture, missing API key, network failure…).
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { DailySummary, Report, ReportPeriod } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { addDaysKey, dateOnlyKey, schoolDayEnd, schoolDayStart, toDateOnly } from "@/lib/dates";
import { getAiProvider } from "@/lib/ai/provider";
import { teacherAgent } from "@/lib/ai/teacher-agent";

const reportSummarySchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  focus: z.array(z.string()),
});

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function endKeyFor(period: ReportPeriod, startKey: string): string {
  if (period === "WEEKLY") return addDaysKey(startKey, 7);
  const d = toDateOnly(startKey);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return dateOnlyKey(d);
}

export interface ReportSubjectStat {
  subjectId: string;
  subjectTitle: string;
  averagePct: number;
  activitiesGraded: number;
}

export interface ReportData {
  periodStart: string;
  periodEnd: string;
  lessonsCompleted: number;
  studyTimeMinutes: number;
  averageAssessmentPct: number | null;
  subjects: ReportSubjectStat[];
  strongestSubject: ReportSubjectStat | null;
  weakestSubject: ReportSubjectStat | null;
  masteryMovement: number | null;
  reviewOutcomes: { reason: string; count: number; averageScorePct: number | null }[];
  ai?: { summary: string; strengths: string[]; focus: string[] };
}

export async function generateReport(studentId: string, period: ReportPeriod, startKey: string): Promise<Report> {
  const endKey = endKeyFor(period, startKey);
  const rangeStart = schoolDayStart(startKey);
  const rangeEnd = schoolDayEnd(addDaysKey(endKey, -1));

  const student = await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId }, include: { user: true } });

  const completedAttempts = await prisma.lessonAttempt.findMany({
    where: { studentId, completedAt: { gte: rangeStart, lt: rangeEnd } },
  });
  const lessonsCompleted = completedAttempts.length;

  const touchedAttempts = await prisma.lessonAttempt.findMany({
    where: { studentId, updatedAt: { gte: rangeStart, lt: rangeEnd } },
  });
  const studyTimeMinutes = Math.round(touchedAttempts.reduce((sum, a) => sum + a.timeSpentSeconds, 0) / 60);

  const checkActivities = await prisma.activityAttempt.findMany({
    where: {
      stage: "CHECK",
      status: "GRADED",
      gradedAt: { gte: rangeStart, lt: rangeEnd },
      lessonAttempt: { studentId },
    },
    include: { lessonAttempt: { include: { lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } } } } },
  });
  const assessmentPcts = checkActivities.map((a) => a.percentage).filter((p): p is number => p != null);
  const averageAssessmentPct = mean(assessmentPcts);

  const bySubject = new Map<string, { subjectId: string; subjectTitle: string; pcts: number[] }>();
  for (const activity of checkActivities) {
    if (activity.percentage == null) continue;
    const subject = activity.lessonAttempt.lesson.unit.programme.subject;
    const entry = bySubject.get(subject.id) ?? { subjectId: subject.id, subjectTitle: subject.title, pcts: [] };
    entry.pcts.push(activity.percentage);
    bySubject.set(subject.id, entry);
  }
  const subjects: ReportSubjectStat[] = [...bySubject.values()]
    .map((s) => ({ subjectId: s.subjectId, subjectTitle: s.subjectTitle, averagePct: mean(s.pcts) ?? 0, activitiesGraded: s.pcts.length }))
    .sort((a, b) => b.averagePct - a.averagePct);
  const strongestSubject = subjects[0] ?? null;
  const weakestSubject = subjects.length > 1 ? subjects[subjects.length - 1] : null;

  const masteryRecords = await prisma.masteryRecord.findMany({
    where: { studentId, createdAt: { gte: rangeStart, lt: rangeEnd }, previousMastery: { not: null } },
  });
  const movements = masteryRecords.map((m) => m.mastery - (m.previousMastery ?? m.mastery));
  const masteryMovement = mean(movements);

  const reviewItems = await prisma.reviewItem.findMany({
    where: { studentId, completedAt: { gte: rangeStart, lt: rangeEnd } },
  });
  const reviewByReason = new Map<string, { count: number; scores: number[] }>();
  for (const item of reviewItems) {
    const entry = reviewByReason.get(item.reason) ?? { count: 0, scores: [] };
    entry.count += 1;
    if (item.outcomeScorePct != null) entry.scores.push(item.outcomeScorePct);
    reviewByReason.set(item.reason, entry);
  }
  const reviewOutcomes = [...reviewByReason.entries()].map(([reason, v]) => ({
    reason,
    count: v.count,
    averageScorePct: mean(v.scores),
  }));

  const data: ReportData = {
    periodStart: startKey,
    periodEnd: addDaysKey(endKey, -1),
    lessonsCompleted,
    studyTimeMinutes,
    averageAssessmentPct,
    subjects,
    strongestSubject,
    weakestSubject,
    masteryMovement,
    reviewOutcomes,
  };

  let teacherSummary: string | null = null;
  try {
    const ai = getAiProvider();
    const { data: summary } = await ai.structured({
      model: "fast",
      schemaName: "reportSummary",
      system:
        `You are a calm, encouraging teacher writing a short ${period === "WEEKLY" ? "weekly" : "monthly"} progress ` +
        `summary for a parent, based only on the stats provided. Be specific and warm, not generic.`,
      messages: [
        {
          role: "user",
          content: `Student: ${student.user.displayName}, year ${student.yearGroup}.\nStats: ${JSON.stringify(data)}`,
        },
      ],
      schema: reportSummarySchema,
    });
    teacherSummary = summary.summary;
    data.ai = summary;
  } catch (err) {
    console.error("generateReport: AI summary unavailable, saving stats only", err);
  }

  return prisma.report.create({
    data: {
      studentId,
      period,
      periodStart: toDateOnly(startKey),
      periodEnd: toDateOnly(data.periodEnd),
      data: data as unknown as Prisma.InputJsonValue,
      teacherSummary,
    },
  });
}

function fallbackDailySummary(stats: {
  lessonsCompleted: number;
  minutes: number;
  averagePct: number | null;
}): string {
  const parts = [`${stats.lessonsCompleted} lesson${stats.lessonsCompleted === 1 ? "" : "s"} completed today`];
  if (stats.minutes > 0) parts.push(`${stats.minutes} minutes of study`);
  if (stats.averagePct != null) parts.push(`an average assessment score of ${Math.round(stats.averagePct)}%`);
  return `${parts.join(", ")}.`;
}

export async function generateDailySummary(studentId: string, dateKey: string): Promise<DailySummary> {
  const rangeStart = schoolDayStart(dateKey);
  const rangeEnd = schoolDayEnd(dateKey);

  const assignments = await prisma.dailyAssignment.findMany({ where: { studentId, date: toDateOnly(dateKey) } });
  const completedAssignments = assignments.filter((a) => a.status === "COMPLETED");

  const touchedAttempts = await prisma.lessonAttempt.findMany({
    where: { studentId, updatedAt: { gte: rangeStart, lt: rangeEnd } },
  });
  const minutes = Math.round(touchedAttempts.reduce((sum, a) => sum + a.timeSpentSeconds, 0) / 60);

  const checkActivities = await prisma.activityAttempt.findMany({
    where: { stage: "CHECK", status: "GRADED", gradedAt: { gte: rangeStart, lt: rangeEnd }, lessonAttempt: { studentId } },
  });
  const averagePct = mean(checkActivities.map((a) => a.percentage).filter((p): p is number => p != null));

  const baseStats = { lessonsCompleted: completedAssignments.length, minutes, averagePct };

  let content: string;
  let data: Record<string, unknown> = { ...baseStats };
  try {
    const result = await teacherAgent.summarizeDay(studentId, dateKey);
    content = result.content;
    data = { ...baseStats, ...(typeof result.data === "object" && result.data ? result.data : {}) };
  } catch (err) {
    console.error("generateDailySummary: AI summary unavailable, saving computed stats only", err);
    content = fallbackDailySummary(baseStats);
  }

  return prisma.dailySummary.upsert({
    where: { studentId_date: { studentId, date: toDateOnly(dateKey) } },
    create: { studentId, date: toDateOnly(dateKey), content, data: data as Prisma.InputJsonValue },
    update: { content, data: data as Prisma.InputJsonValue },
  });
}
