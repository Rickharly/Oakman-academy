import { describe, expect, it } from "vitest";

/**
 * A child pressed "give me more questions" and got back the set he had just finished.
 *
 * The generator was handed the same lesson, the same learning points and the same instructions
 * every time, with no idea what it had already written — so it wrote the same thing. Knowing
 * what has been asked is the whole difference between more practice and the same practice.
 *
 * The comparison has to be loose. A model that is told not to repeat a question will happily
 * change "What is 3/4 of 20?" to "What is 3/4 of 20 ?" or re-punctuate it; a child recognises
 * that instantly as the same question.
 */
const normalise = (prompt: string) => prompt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

describe("telling a repeated question from a new one", () => {
  it("treats punctuation and case as noise", () => {
    expect(normalise("What is 3/4 of 20?")).toBe(normalise("what is 3 4 of 20"));
    expect(normalise("Explain why 2/4 = 1/2.")).toBe(normalise("EXPLAIN WHY 2/4 = 1/2"));
  });

  it("keeps genuinely different questions apart", () => {
    expect(normalise("What is 3/4 of 20?")).not.toBe(normalise("What is 3/4 of 40?"));
    expect(normalise("Simplify 6/8.")).not.toBe(normalise("Simplify 9/12."));
  });

  it("catches a repeat dressed up with different spacing", () => {
    const asked = new Set([normalise("Which of these fractions is equivalent to 1/2?")]);
    expect(asked.has(normalise("  Which of these fractions is equivalent to 1/2 ?  "))).toBe(true);
  });
});
