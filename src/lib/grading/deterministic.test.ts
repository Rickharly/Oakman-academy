import { describe, expect, it } from "vitest";
import { gradeDeterministic, normaliseShortAnswer, parseNumericAnswer } from "./deterministic";

type Q = Parameters<typeof gradeDeterministic>[0];

function q(type: Q["type"], answerKey: unknown, maxScore = 1, options: unknown = null): Q {
  return { type, options, answerKey, maxScore } as Q;
}

describe("parseNumericAnswer", () => {
  it("parses plain decimals and integers", () => {
    expect(parseNumericAnswer("0.75")).toBeCloseTo(0.75);
    expect(parseNumericAnswer("42")).toBe(42);
  });
  it("parses simple fractions", () => {
    expect(parseNumericAnswer("3/4")).toBeCloseTo(0.75);
  });
  it("parses mixed numbers", () => {
    expect(parseNumericAnswer("1 1/2")).toBeCloseTo(1.5);
    expect(parseNumericAnswer("-1 1/2")).toBeCloseTo(-1.5);
  });
  it("parses negatives, including the unicode minus sign", () => {
    expect(parseNumericAnswer("-2")).toBe(-2);
    expect(parseNumericAnswer("−2")).toBe(-2);
  });
  it("strips thousands separators", () => {
    expect(parseNumericAnswer("1,000")).toBe(1000);
  });
  it("strips surrounding = signs and whitespace", () => {
    expect(parseNumericAnswer("= 5")).toBe(5);
    expect(parseNumericAnswer("  5 =")).toBe(5);
  });
  it("strips units", () => {
    expect(parseNumericAnswer("5cm")).toBe(5);
    expect(parseNumericAnswer("£5")).toBe(5);
  });
  it("returns null for unparsable input", () => {
    expect(parseNumericAnswer("banana")).toBeNull();
    expect(parseNumericAnswer("")).toBeNull();
    expect(parseNumericAnswer("   ")).toBeNull();
  });
});

describe("normaliseShortAnswer", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normaliseShortAnswer("  The   Mitochondria  ")).toBe("mitochondria");
  });
  it("strips trailing punctuation", () => {
    expect(normaliseShortAnswer("mitochondria.")).toBe("mitochondria");
    expect(normaliseShortAnswer("mitochondria!")).toBe("mitochondria");
  });
  it("strips a single leading article", () => {
    expect(normaliseShortAnswer("a cell")).toBe("cell");
    expect(normaliseShortAnswer("an atom")).toBe("atom");
    expect(normaliseShortAnswer("the sun")).toBe("sun");
  });
  it("respects case sensitivity", () => {
    expect(normaliseShortAnswer("London", true)).toBe("London");
    expect(normaliseShortAnswer("London", false)).toBe("london");
  });
});

describe("gradeDeterministic", () => {
  describe("MULTIPLE_CHOICE", () => {
    const key = { correctOptionId: "b" };

    it("full credit for the correct option", () => {
      const r = gradeDeterministic(q("MULTIPLE_CHOICE", key), { optionId: "b" });
      expect(r).not.toBeNull();
      expect(r!.correct).toBe(true);
      expect(r!.score).toBe(1);
      expect(r!.mastery).toBe(1);
    });

    it("zero credit for a wrong option, without revealing the answer", () => {
      const r = gradeDeterministic(q("MULTIPLE_CHOICE", key), { optionId: "a" });
      expect(r!.correct).toBe(false);
      expect(r!.score).toBe(0);
      expect(r!.feedbackForStudent.toLowerCase()).not.toContain("correct answer is");
    });

    it("an empty response is incorrect, not null", () => {
      const r = gradeDeterministic(q("MULTIPLE_CHOICE", key), { optionId: "" });
      expect(r).not.toBeNull();
      expect(r!.correct).toBe(false);
      expect(r!.score).toBe(0);
    });
  });

  describe("MULTI_SELECT", () => {
    const key = { correctOptionIds: ["a", "b", "c"] };

    it("full credit only for an exact set match", () => {
      const r = gradeDeterministic(q("MULTI_SELECT", key, 3), { optionIds: ["c", "a", "b"] });
      expect(r!.correct).toBe(true);
      expect(r!.score).toBe(3);
    });

    it("partial credit: max(0, correct-wrong)/total, rounded 2dp", () => {
      // 2 correct (a,b), 0 wrong -> (2-0)/3 * 3 = 2
      const r1 = gradeDeterministic(q("MULTI_SELECT", key, 3), { optionIds: ["a", "b"] });
      expect(r1!.correct).toBe(false);
      expect(r1!.score).toBeCloseTo(2, 2);

      // 1 correct (a), 1 wrong (d) -> max(0, (1-1)/3) = 0
      const r2 = gradeDeterministic(q("MULTI_SELECT", key, 3), { optionIds: ["a", "d"] });
      expect(r2!.correct).toBe(false);
      expect(r2!.score).toBe(0);
    });

    it("an empty selection is incorrect, not null", () => {
      const r = gradeDeterministic(q("MULTI_SELECT", key, 3), { optionIds: [] });
      expect(r).not.toBeNull();
      expect(r!.score).toBe(0);
    });
  });

  describe("TRUE_FALSE", () => {
    it("matches the boolean exactly", () => {
      const r1 = gradeDeterministic(q("TRUE_FALSE", { value: true }), { value: true });
      expect(r1!.correct).toBe(true);
      const r2 = gradeDeterministic(q("TRUE_FALSE", { value: true }), { value: false });
      expect(r2!.correct).toBe(false);
    });
  });

  describe("NUMERIC", () => {
    const key = { value: 0.75, tolerance: 0.01 };

    it("accepts a decimal, a fraction, and a padded '=' form within tolerance", () => {
      expect(gradeDeterministic(q("NUMERIC", key), { text: "0.75" })!.correct).toBe(true);
      expect(gradeDeterministic(q("NUMERIC", key), { text: "3/4" })!.correct).toBe(true);
      expect(gradeDeterministic(q("NUMERIC", key), { text: " = 0.75 " })!.correct).toBe(true);
    });

    it("rejects a value outside tolerance", () => {
      expect(gradeDeterministic(q("NUMERIC", key), { text: "1 1/2" })!.correct).toBe(false);
    });

    it("accepts an exact acceptedStrings match even when not numerically parsable the same way", () => {
      const k = { value: 0.75, tolerance: 0, acceptedStrings: ["three quarters"] };
      const r = gradeDeterministic(q("NUMERIC", k), { text: "three quarters" });
      expect(r!.correct).toBe(true);
      expect(r!.score).toBe(1);
    });

    it("handles thousands separators and units", () => {
      const k = { value: 1000, tolerance: 0 };
      expect(gradeDeterministic(q("NUMERIC", k), { text: "1,000" })!.correct).toBe(true);
      const k2 = { value: 5, tolerance: 0 };
      expect(gradeDeterministic(q("NUMERIC", k2), { text: "5cm" })!.correct).toBe(true);
    });

    it("an empty response is incorrect, not null", () => {
      const r = gradeDeterministic(q("NUMERIC", key), { text: "" });
      expect(r).not.toBeNull();
      expect(r!.correct).toBe(false);
    });

    it("an unparsable response is incorrect, not null", () => {
      const r = gradeDeterministic(q("NUMERIC", key), { text: "dunno" });
      expect(r).not.toBeNull();
      expect(r!.correct).toBe(false);
    });
  });

  describe("MATCHING", () => {
    const key = {
      pairs: [
        { leftId: "l1", rightId: "r1" },
        { leftId: "l2", rightId: "r2" },
        { leftId: "l3", rightId: "r3" },
      ],
    };

    it("full credit when every pair matches", () => {
      const r = gradeDeterministic(q("MATCHING", key, 3), {
        pairs: [
          { leftId: "l1", rightId: "r1" },
          { leftId: "l2", rightId: "r2" },
          { leftId: "l3", rightId: "r3" },
        ],
      });
      expect(r!.correct).toBe(true);
      expect(r!.score).toBe(3);
    });

    it("partial credit by number of correct pairs", () => {
      const r = gradeDeterministic(q("MATCHING", key, 3), {
        pairs: [
          { leftId: "l1", rightId: "r1" },
          { leftId: "l2", rightId: "r3" },
          { leftId: "l3", rightId: "r2" },
        ],
      });
      expect(r!.correct).toBe(false);
      expect(r!.score).toBeCloseTo(1, 2);
    });

    it("an empty response is incorrect, not null", () => {
      const r = gradeDeterministic(q("MATCHING", key, 3), { pairs: [] });
      expect(r).not.toBeNull();
      expect(r!.score).toBe(0);
    });
  });

  describe("ORDERING", () => {
    const key = { order: ["1", "2", "3", "4"] };

    it("full credit only when every position matches", () => {
      const r = gradeDeterministic(q("ORDERING", key, 4), { order: ["1", "2", "3", "4"] });
      expect(r!.correct).toBe(true);
      expect(r!.score).toBe(4);
    });

    it("partial credit by correct positions", () => {
      const r = gradeDeterministic(q("ORDERING", key, 4), { order: ["1", "3", "2", "4"] });
      expect(r!.correct).toBe(false);
      expect(r!.score).toBeCloseTo(2, 2);
    });

    it("an empty response is incorrect, not null", () => {
      const r = gradeDeterministic(q("ORDERING", key, 4), { order: [] });
      expect(r).not.toBeNull();
      expect(r!.score).toBe(0);
    });
  });

  describe("SHORT_ANSWER", () => {
    it("matches after normalisation", () => {
      const key = { accepted: ["mitochondria"], caseSensitive: false };
      const r = gradeDeterministic(q("SHORT_ANSWER", key), { text: "The Mitochondria." });
      expect(r).not.toBeNull();
      expect(r!.correct).toBe(true);
      expect(r!.score).toBe(1);
    });

    it("returns null (defer to AI) when non-empty text doesn't match anything accepted", () => {
      const key = { accepted: ["mitochondria"], caseSensitive: false };
      const r = gradeDeterministic(q("SHORT_ANSWER", key), { text: "powerhouse organelle" });
      expect(r).toBeNull();
    });

    it("returns null (defer to AI) when accepted is empty, for a non-empty answer", () => {
      const key = { accepted: [], caseSensitive: false };
      const r = gradeDeterministic(q("SHORT_ANSWER", key), { text: "anything" });
      expect(r).toBeNull();
    });

    it("returns an incorrect result (not null) for an empty answer", () => {
      const key = { accepted: ["mitochondria"], caseSensitive: false };
      const r = gradeDeterministic(q("SHORT_ANSWER", key), { text: "   " });
      expect(r).not.toBeNull();
      expect(r!.correct).toBe(false);
      expect(r!.score).toBe(0);
    });
  });

  describe("EXTENDED_TEXT", () => {
    it("always defers to AI", () => {
      const r = gradeDeterministic(q("EXTENDED_TEXT", { modelAnswer: "anything" }), { text: "some essay" });
      expect(r).toBeNull();
    });
  });

  it("mastery always equals score/maxScore", () => {
    const r = gradeDeterministic(q("MULTI_SELECT", { correctOptionIds: ["a", "b"] }, 2), { optionIds: ["a"] });
    expect(r!.mastery).toBeCloseTo(r!.score / r!.maxScore, 5);
  });
});
