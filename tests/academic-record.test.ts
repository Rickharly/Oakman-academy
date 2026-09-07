import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { buildAcademicRecord, PROVENANCE, saveAcademicRecord } from "@/lib/records/academic-record";
import { markDayStarted, plannedStartInstant, recordTimeBreakdown } from "@/lib/engagement/service";
import { seedReadingLibrary } from "@/lib/reading/library";
import { submitReadingResponse } from "@/lib/reading/service";
import { toDateOnly } from "@/lib/dates";

const DATE = "2026-09-07";

let studentId: string;

beforeAll(async () => {
  await resetDb();
  await seedReadingLibrary();

  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "recorded", passwordHash: "x", displayName: "Eva Oakman" },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3", schoolStartTime: "13:00" },
  });
  studentId = profile.id;

  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: "m:7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: "u1", programmeId: programme.id, title: "Fractions", order: 1 },
  });

  // Two lessons finished well, one left unfinished — the record must not claim the third.
  for (const [i, spec] of [
    { title: "Comparing fractions", score: 90, mastery: 0.9, status: "COMPLETED" as const },
    { title: "Adding fractions", score: 55, mastery: 0.45, status: "COMPLETED" as const },
    { title: "Dividing fractions", score: null, mastery: null, status: "IN_PROGRESS" as const },
  ].entries()) {
    const lesson = await prisma.lesson.create({
      data: { provider: "test", providerSlug: `l${i}`, unitId: unit.id, title: spec.title, order: i + 1 },
    });
    await prisma.studentLessonProgress.create({
      data: {
        studentId,
        lessonId: lesson.id,
        status: spec.status,
        attempts: 1,
        bestScorePct: spec.score,
        mastery: spec.mastery,
        needsReview: spec.mastery !== null && spec.mastery < 0.6,
        completedAt: spec.status === "COMPLETED" ? toDateOnly(DATE) : null,
      },
    });
  }

  // A day worked, twelve minutes late, with some idle time.
  await markDayStarted(studentId, new Date(plannedStartInstant(DATE, "13:00").getTime() + 12 * 60_000), DATE);
  const lesson = await prisma.lesson.findFirstOrThrow({ where: { title: "Comparing fractions" } });
  const attempt = await prisma.lessonAttempt.create({
    data: { studentId, lessonId: lesson.id, attemptNumber: 1, timeSpentSeconds: 2700, startedLateSeconds: 0 },
  });
  await recordTimeBreakdown(attempt.id, studentId, { activeSeconds: 600, idleSeconds: 120, awaySeconds: 0 });

  const text = await prisma.readingText.findFirstOrThrow({ where: { yearGroup: 7 }, orderBy: { order: "asc" } });
  await submitReadingResponse({
    studentId,
    readingTextId: text.id,
    promptIndex: 0,
    response: "The rain is in every paragraph and it slows the whole thing down.",
  });
});

describe("the academic record", () => {
  it("counts only work that was actually finished", async () => {
    const record = await buildAcademicRecord(studentId);
    expect(record.totals.lessonsCompleted).toBe(2);
    expect(record.subjects[0].lessonsCompleted).toBe(2);
    // The unfinished lesson is not listed as covered.
    expect(record.subjects[0].units[0].lessonTitles).not.toContain("Dividing fractions");
  });

  it("names the framework a receiving school can look up", async () => {
    const record = await buildAcademicRecord(studentId);
    expect(record.subjects[0].framework).toContain("English National Curriculum");
    expect(record.subjects[0].framework).toContain("Year 7");
  });

  it("reports the real average, not a flattering one", async () => {
    const record = await buildAcademicRecord(studentId);
    // 90 and 55 — the weak result is in the average and in the record.
    expect(record.totals.averageAssessmentPct).toBe(73);
    expect(record.subjects[0].assessments.map((a) => a.scorePct).sort()).toEqual([55, 90]);
    expect(record.subjects[0].needsWork).toContain("Adding fractions");
  });

  it("reports attendance and application from what was recorded", async () => {
    const record = await buildAcademicRecord(studentId);
    expect(record.attendance.daysAttended).toBe(1);
    expect(record.totals.instructionalHours).toBe(0.8); // 2700s = 45 min
    expect(record.attendance.focusPct).toBe(83); // 600 / 720
  });

  it("quotes the child's own writing verbatim", async () => {
    const record = await buildAcademicRecord(studentId);
    expect(record.writing).toHaveLength(1);
    expect(record.writing[0].response).toBe(
      "The rain is in every paragraph and it slows the whole thing down.",
    );
  });

  it("says on its face how it was produced and who wrote the notes", async () => {
    const record = await buildAcademicRecord(studentId);
    expect(record.provenance).toBe(PROVENANCE);
    expect(record.provenance).toMatch(/AI teacher/);
    expect(record.provenance).toMatch(/parent/i);
  });

  it("writes subject notes grounded in the units actually covered", async () => {
    const record = await buildAcademicRecord(studentId, { withNotes: true });
    expect(record.subjects[0].note).toBeTruthy();
    expect(record.subjects[0].note).toContain("Fractions");
  });

  it("saves the issued document so it can be reproduced exactly", async () => {
    const record = await buildAcademicRecord(studentId, { withNotes: true });
    const saved = await saveAcademicRecord(studentId, record);

    const reloaded = await prisma.report.findUniqueOrThrow({ where: { id: saved.id } });
    expect(reloaded.period).toBe("ACADEMIC_RECORD");
    const data = reloaded.data as unknown as typeof record;
    expect(data.totals.lessonsCompleted).toBe(2);
    expect(data.writing[0].response).toBe(record.writing[0].response);
  });
});

describe("what the record leaves out", () => {
  it("omits a subject with nothing finished rather than printing a zero", async () => {
    const subject = await prisma.subject.create({
      data: { provider: "test", slug: "latin", title: "Latin" },
    });
    const programme = await prisma.programme.create({
      data: { provider: "test", providerSlug: "lat:7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Latin" },
    });
    const unit = await prisma.unit.create({
      data: { provider: "test", providerSlug: "lu1", programmeId: programme.id, title: "Nouns", order: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: { provider: "test", providerSlug: "ll1", unitId: unit.id, title: "First declension", order: 1 },
    });
    // Opened but never finished.
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: lesson.id, status: "IN_PROGRESS", attempts: 1 },
    });

    const record = await buildAcademicRecord(studentId);
    expect(record.subjects.map((s) => s.subjectTitle)).not.toContain("Latin");
    expect(record.subjects.map((s) => s.subjectTitle)).toContain("Maths");
  });
});
