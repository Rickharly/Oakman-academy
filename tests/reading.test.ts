import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { loadReadingFixtures, seedReadingLibrary } from "@/lib/reading/library";
import {
  getNextReadingText,
  getReadingHistory,
  getReadingSummary,
  judgePace,
  submitReadingResponse,
} from "@/lib/reading/service";
import { planWeek } from "@/lib/scheduling/planner";
import { toDateOnly, weekStartKey } from "@/lib/dates";

const MONDAY = weekStartKey("2026-09-07");

let studentId: string;

async function makeStudent(yearGroup: number) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: `reader-${yearGroup}`, passwordHash: "x", displayName: "Reader" },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup, keyStage: yearGroup > 6 ? "ks3" : "ks2" },
  });
  return profile.id;
}

describe("the bundled reading library", () => {
  it("is valid and covers both children's year groups", () => {
    const texts = loadReadingFixtures();
    expect(texts.length).toBeGreaterThanOrEqual(20);
    expect(texts.filter((t) => t.yearGroup === 5).length).toBeGreaterThanOrEqual(10);
    expect(texts.filter((t) => t.yearGroup === 7).length).toBeGreaterThanOrEqual(10);
    // Every passage must give them something to write about, and some must be essays.
    expect(texts.every((t) => t.prompts.length > 0)).toBe(true);
    expect(texts.some((t) => t.essayPrompt)).toBe(true);
  });
});

describe("reading", () => {
  beforeAll(async () => {
    await resetDb();
    await seedReadingLibrary();
    studentId = await makeStudent(7);
  });

  it("seeds idempotently", async () => {
    const before = await prisma.readingText.count();
    await seedReadingLibrary();
    expect(await prisma.readingText.count()).toBe(before);
  });

  it("offers the year group's texts in order, and moves on once one is answered", async () => {
    const first = await getNextReadingText(studentId);
    expect(first).not.toBeNull();
    expect(first!.yearGroup).toBe(7);
    expect(first!.order).toBe(1);

    await submitReadingResponse({
      studentId,
      readingTextId: first!.id,
      promptIndex: 0,
      response: "The rain made the pitch hard to run on, and Maya kept going anyway.",
    });

    const second = await getNextReadingText(studentId);
    expect(second!.id).not.toBe(first!.id);
    expect(second!.order).toBe(2);
  });

  it("answers a short response without marking it", async () => {
    const [entry] = await getReadingHistory(studentId, 1);
    expect(entry.kind).toBe("RESPONSE");
    expect(entry.feedback).toBeTruthy();
    expect(entry.score).toBeNull();
    // The parent's note is recorded but is not the child's feedback.
    expect(entry.reasoning).toBeTruthy();
  });

  it("marks an essay out of 8", async () => {
    const essayText = await prisma.readingText.findFirst({
      where: { yearGroup: 7, essayPrompt: { not: null } },
      orderBy: { order: "asc" },
    });
    const entry = await submitReadingResponse({
      studentId,
      readingTextId: essayText!.id,
      promptIndex: null,
      response: "A long answer about the boiled egg. ".repeat(30),
    });

    expect(entry.kind).toBe("ESSAY");
    expect(entry.maxScore).toBe(8);
    expect(entry.score).not.toBeNull();
    expect(entry.score!).toBeGreaterThanOrEqual(0);
    expect(entry.score!).toBeLessThanOrEqual(8);
  });

  it("keeps every piece of writing — nothing is overwritten", async () => {
    const summary = await getReadingSummary(studentId);
    expect(summary.entries).toBe(2);
    expect(summary.essays).toBe(1);
    expect(summary.textsRead).toBe(2);
  });

  it("refuses an empty response rather than saving one", async () => {
    const text = await getNextReadingText(studentId);
    await expect(
      submitReadingResponse({ studentId, readingTextId: text!.id, promptIndex: 0, response: " " }),
    ).rejects.toThrow();
  });

  it("closes the assignment when they write, and does not lose the entry", async () => {
    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(MONDAY),
        order: 99,
        kind: "READING",
        source: "AUTO",
        estimatedMinutes: 20,
      },
    });
    const text = await getNextReadingText(studentId);
    const entry = await submitReadingResponse({
      studentId,
      readingTextId: text!.id,
      promptIndex: 0,
      response: "I liked the ending because it did not explain everything.",
      assignmentId: assignment.id,
    });

    expect(entry.assignmentId).toBe(assignment.id);
    const after = await prisma.dailyAssignment.findUnique({ where: { id: assignment.id } });
    expect(after!.status).toBe("COMPLETED");
    expect(after!.completedAt).not.toBeNull();
  });
});

describe("reading in the timetable", () => {
  beforeAll(async () => {
    await resetDb();
    await seedReadingLibrary();
    studentId = await makeStudent(5);
    await planWeek(studentId, MONDAY, { replace: true });
  });

  it("adds one short reading slot to every school day, after the lessons", async () => {
    const reading = await prisma.dailyAssignment.findMany({
      where: { studentId, kind: "READING" },
      orderBy: [{ date: "asc" }, { order: "asc" }],
    });
    expect(reading).toHaveLength(5);
    expect(reading.every((a) => a.estimatedMinutes === 20)).toBe(true);

    // It is the last thing on the day.
    const monday = await prisma.dailyAssignment.findMany({
      where: { studentId, date: toDateOnly(MONDAY) },
      orderBy: { order: "asc" },
    });
    expect(monday.at(-1)!.kind).toBe("READING");
  });

  it("does not add a second one when the week is re-planned", async () => {
    await planWeek(studentId, MONDAY);
    const reading = await prisma.dailyAssignment.count({ where: { studentId, kind: "READING" } });
    expect(reading).toBe(5);
  });

  it("plans no reading when the library has nothing for that year group", async () => {
    const yearNine = await makeStudent(9);
    await planWeek(yearNine, MONDAY, { replace: true });
    expect(await prisma.dailyAssignment.count({ where: { studentId: yearNine, kind: "READING" } })).toBe(0);
  });
});

describe("reading pace", () => {
  it("flags a chapter clicked through far too fast", () => {
    // 2,000 words should take ~11 minutes; forty seconds is not reading.
    expect(judgePace(40, 2000)).toBe("rushed");
  });

  it("calls a sensible range steady, including a careful reread", () => {
    expect(judgePace(11 * 60, 2000)).toBe("steady");
    expect(judgePace(25 * 60, 2000)).toBe("steady"); // read it twice — still fine
  });

  it("only says slow when the gap is large", () => {
    expect(judgePace(60 * 60, 2000)).toBe("slow");
  });

  it("does not punish a short passage read briskly", () => {
    // A 60-word poem: expected floor is 30s, so 20s is not yet rushed territory abuse.
    expect(judgePace(20, 60)).toBe("steady");
  });

  it("records the pace alongside the writing", async () => {
    const text = await getNextReadingText(studentId);
    const entry = await submitReadingResponse({
      studentId,
      readingTextId: text!.id,
      promptIndex: 0,
      response: "I thought the ending was left open on purpose.",
      readingSeconds: 5,
    });
    expect(entry.readingSeconds).toBe(5);
    expect(entry.readingPace).toBe("rushed");
  });

  it("clamps a tab left open overnight", async () => {
    const text = await getNextReadingText(studentId);
    const entry = await submitReadingResponse({
      studentId,
      readingTextId: text!.id,
      promptIndex: 0,
      response: "Coming back to this the next morning.",
      readingSeconds: 60 * 60 * 20,
    });
    expect(entry.readingSeconds).toBe(4 * 60 * 60);
  });
});

describe("a year group with no passages of its own", () => {
  it("falls back to the nearest year rather than showing nothing", async () => {
    await resetDb();
    await seedReadingLibrary(); // the library holds years 5 and 7 only
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "year-four", passwordHash: "x", displayName: "Y4" },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, yearGroup: 4, keyStage: "ks2" },
    });

    const next = await getNextReadingText(profile.id);
    expect(next).not.toBeNull();
    // Year 5 is nearer to Year 4 than Year 7 is.
    expect(next!.yearGroup).toBe(5);
  });
});
