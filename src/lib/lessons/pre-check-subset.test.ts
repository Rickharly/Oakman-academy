import { describe, expect, it } from "vitest";
import { preCheckQuestions } from "./pre-check-subset";

describe("preCheckQuestions", () => {
  it("asks the whole quiz when it is short", () => {
    expect(preCheckQuestions([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });
  it("asks half of a longer quiz, leaving the rest fresh for the end of the lesson", () => {
    expect(preCheckQuestions([1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3]);
    expect(preCheckQuestions([1, 2, 3, 4, 5, 6, 7])).toEqual([1, 2, 3, 4]);
  });
});
