import { describe, expect, it } from "vitest";
import { strictestMode, teacherModeForStage } from "./context";

describe("strictestMode", () => {
  it("keeps the stricter of two modes", () => {
    expect(strictestMode("LEARN", "ASSESSMENT")).toBe("ASSESSMENT");
    expect(strictestMode("ASSESSMENT", "LEARN")).toBe("ASSESSMENT");
    expect(strictestMode("LEARN", "PRACTICE")).toBe("PRACTICE");
    expect(strictestMode("LEARN")).toBe("LEARN");
  });

  it("treats a child sitting on the quiz as being assessed, whatever the stored stage says", () => {
    // The row is written when a stage is submitted; the screen changes on a click. If the two
    // disagree, answering as though the child were still learning hands them the answer.
    const stored = teacherModeForStage("LEARN");
    const onScreen = teacherModeForStage("CHECK");
    expect(strictestMode(stored, onScreen)).toBe("ASSESSMENT");
  });

  it("never lets the screen relax the stored stage", () => {
    expect(strictestMode(teacherModeForStage("CHECK"), teacherModeForStage("LEARN"))).toBe("ASSESSMENT");
  });
});
