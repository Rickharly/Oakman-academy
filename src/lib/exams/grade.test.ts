import { describe, expect, it } from "vitest";
import { letterGrade } from "./grade";

describe("letter grades", () => {
  it("uses the ordinary North American scale", () => {
    expect(letterGrade(100).letter).toBe("A+");
    expect(letterGrade(97).letter).toBe("A+");
    expect(letterGrade(96).letter).toBe("A");
    expect(letterGrade(93).letter).toBe("A");
    expect(letterGrade(92).letter).toBe("A-");
    expect(letterGrade(90).letter).toBe("A-");
    expect(letterGrade(89).letter).toBe("B+");
    expect(letterGrade(83).letter).toBe("B");
    expect(letterGrade(80).letter).toBe("B-");
    expect(letterGrade(77).letter).toBe("C+");
    expect(letterGrade(70).letter).toBe("C-");
    expect(letterGrade(69).letter).toBe("D+");
    expect(letterGrade(60).letter).toBe("D-");
    expect(letterGrade(59).letter).toBe("F");
    expect(letterGrade(0).letter).toBe("F");
  });

  it("survives a score outside the range rather than returning nothing", () => {
    expect(letterGrade(120).letter).toBe("A+");
    expect(letterGrade(-5).letter).toBe("F");
  });

  it("says what the letter means, because a letter alone is just a label", () => {
    expect(letterGrade(95).meaning).toMatch(/Excellent/);
    expect(letterGrade(40).meaning).toMatch(/Not yet/);
  });
});
