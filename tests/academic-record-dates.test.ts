import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { saveAcademicRecord, type AcademicRecord } from "@/lib/records/academic-record";

/**
 * Regression tests for commit eed2064: `saveAcademicRecord` used to file `periodStart`/
 * `periodEnd` through `schoolDayStart`/`schoolDayEnd` — an absolute instant in the family's
 * timezone — into `@db.Date` columns that only ever mean UTC midnight, landing the record a
 * day early. It now stores UTC midnight of the given key directly via `toDateOnly`.
 */

function minimalRecord(overrides: Partial<AcademicRecord> = {}): AcademicRecord {
  return {
    student: { name: "Eva", yearGroup: 7, keyStage: "ks3" },
    generatedAt: new Date(),
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    totals: {
      lessonsCompleted: 0,
      questionsAnswered: 0,
      instructionalHours: 0,
      daysAttended: 0,
      averageAssessmentPct: null,
    },
    attendance: {
      daysAttended: 0,
      onTimeStarts: 0,
      lateStarts: 0,
      averageStartTime: null,
      focusPct: null,
    },
    subjects: [],
    writing: [],
    provenance: "test",
    ...overrides,
  };
}

describe("saveAcademicRecord: period dates are stored as UTC midnight of the given keys", () => {
  let studentId: string;

  beforeAll(async () => {
    await resetDb();
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "eva-record", passwordHash: "x", displayName: "Eva" },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
    });
    studentId = profile.id;
  });

  it("periodStart '2026-09-01' is stored as Date.UTC(2026,8,1), not shifted by the family's timezone", async () => {
    const record = minimalRecord({ periodStart: "2026-09-01", periodEnd: "2026-09-30" });
    const saved = await saveAcademicRecord(studentId, record);

    const reloaded = await prisma.report.findUniqueOrThrow({ where: { id: saved.id } });
    expect(reloaded.periodStart.getTime()).toBe(Date.UTC(2026, 8, 1));
    expect(reloaded.periodEnd.getTime()).toBe(Date.UTC(2026, 8, 30));
  });

  it("falls back to today (as a date-only key) when periodStart/periodEnd are null", async () => {
    const record = minimalRecord({ periodStart: null, periodEnd: null });
    const saved = await saveAcademicRecord(studentId, record);

    const reloaded = await prisma.report.findUniqueOrThrow({ where: { id: saved.id } });
    // Whatever "today" resolved to, it must be exact UTC midnight (no time-of-day component).
    expect(reloaded.periodStart.getUTCHours()).toBe(0);
    expect(reloaded.periodStart.getUTCMinutes()).toBe(0);
    expect(reloaded.periodEnd.getUTCHours()).toBe(0);
  });

  it("saves under the ACADEMIC_RECORD period, distinct from WEEKLY/MONTHLY reports", async () => {
    const record = minimalRecord();
    const saved = await saveAcademicRecord(studentId, record);
    const reloaded = await prisma.report.findUniqueOrThrow({ where: { id: saved.id } });
    expect(reloaded.period).toBe("ACADEMIC_RECORD");
  });
});

describe("the reports listing excludes academic records", () => {
  // Pins the query src/app/(admin)/admin/reports/page.tsx uses to list periodic reports —
  // the reports page used to crash the moment a child's academic record had been saved once,
  // because it read weekly-report fields (a different shape) off the ACADEMIC_RECORD row.
  it("prisma.report.findMany({ where: { period: { in: ['WEEKLY','MONTHLY'] } } }) excludes an ACADEMIC_RECORD row", async () => {
    await resetDb();
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "eva-listing", passwordHash: "x", displayName: "Eva" },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
    });
    const studentId = profile.id;

    await saveAcademicRecord(studentId, minimalRecord());
    const weekly = await prisma.report.create({
      data: {
        studentId,
        period: "WEEKLY",
        periodStart: new Date(Date.UTC(2026, 8, 7)),
        periodEnd: new Date(Date.UTC(2026, 8, 13)),
        data: {},
      },
    });

    const listed = await prisma.report.findMany({
      where: { studentId, period: { in: ["WEEKLY", "MONTHLY"] } },
    });

    expect(listed.map((r) => r.id)).toEqual([weekly.id]);
    expect(listed.every((r) => r.period !== "ACADEMIC_RECORD")).toBe(true);
  });
});
