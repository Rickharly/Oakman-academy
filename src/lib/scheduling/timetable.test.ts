import { describe, expect, it } from "vitest";
import { buildTimetable, dayEndsAt, teachingMinutes } from "./timetable";

const lesson = (id: string) => ({ id, estimatedMinutes: 45, kind: "LESSON" });

describe("timetable", () => {
  it("runs periods back to back with a break between them", () => {
    const rows = buildTimetable([lesson("a"), lesson("b"), lesson("c")], "09:00", 10);

    expect(rows.map((r) => `${r.startsAt}–${r.endsAt}`)).toEqual([
      "09:00–09:45",
      "09:55–10:40",
      "10:50–11:35",
    ]);
  });

  it("numbers the lesson periods and leaves reviews unnumbered", () => {
    const rows = buildTimetable(
      [{ id: "r", estimatedMinutes: 15, kind: "REVIEW" }, lesson("a"), lesson("b")],
      "09:00",
      10,
    );

    expect(rows.map((r) => r.period)).toEqual([0, 1, 2]);
    // The review still takes its slot in the day, pushing the first lesson later.
    expect(rows[1].startsAt).toBe("09:25");
  });

  it("reports teaching time without counting the breaks", () => {
    const items = [lesson("a"), lesson("b"), lesson("c"), lesson("d"), lesson("e")];

    expect(teachingMinutes(items)).toBe(225); // 3h45
    // Five 45-minute periods and four 10-minute breaks: 09:00 → 13:25.
    expect(dayEndsAt(items, "09:00", 10)).toBe("13:25");
  });

  it("handles a later start and an empty day", () => {
    expect(buildTimetable([lesson("a")], "13:30", 10)[0].endsAt).toBe("14:15");
    expect(dayEndsAt([], "09:00", 10)).toBe("09:00");
  });

  it("falls back to a sane start when the stored time is malformed", () => {
    expect(buildTimetable([lesson("a")], "not-a-time", 10)[0].startsAt).toBe("09:00");
  });
});
