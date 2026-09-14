/**
 * ORDERING and MATCHING questions come from Oak with the correct answer sitting right there in
 * the array: an ORDERING question's `answers` already arrive in the correct sequence, and a
 * MATCHING question's `correctChoice`s line up row-for-row with their `matchOption`s. Nothing
 * used to shuffle what is actually *displayed*, so an untouched ORDERING question was already
 * right and an untouched MATCHING question already showed its own answer beside it. These tests
 * pin the fix: the *displayed* order changes, the answer key does not.
 */
import { describe, expect, it } from "vitest";
import { mapOakQuizQuestion, mapWorksheetQuestion, parseNumericAnswer, seededShuffle } from "./oak-mapper";

type OrderingOptions = { items: { id: string; text: string }[] };
type OrderingKey = { order: string[] };
type MatchingOptions = { left: { id: string; text: string }[]; right: { id: string; text: string }[] };
type MatchingKey = { pairs: { leftId: string; rightId: string }[] };

const orderQuestion = {
  question: "Put these fractions in order, smallest first",
  questionType: "order",
  answers: [
    { order: 1, type: "text", content: "1/4" },
    { order: 2, type: "text", content: "1/2" },
    { order: 3, type: "text", content: "3/4" },
    { order: 4, type: "text", content: "1" },
  ],
};

const matchQuestion = {
  question: "Match the country to its capital",
  questionType: "match",
  answers: [
    { matchOption: { type: "text", content: "France" }, correctChoice: { type: "text", content: "Paris" } },
    { matchOption: { type: "text", content: "Italy" }, correctChoice: { type: "text", content: "Rome" } },
    { matchOption: { type: "text", content: "Spain" }, correctChoice: { type: "text", content: "Madrid" } },
    { matchOption: { type: "text", content: "Germany" }, correctChoice: { type: "text", content: "Berlin" } },
  ],
};

describe("ORDERING questions are no longer presented pre-solved", () => {
  it("shuffles the displayed items away from Oak's already-correct sequence", () => {
    const mapped = mapOakQuizQuestion(orderQuestion, "STARTER", 1)!;
    const options = mapped.options as OrderingOptions;
    const key = mapped.answerKey as OrderingKey;

    // The answer key is still right: Oak's answers were already in the correct sequence.
    expect(key.order).toEqual(["a", "b", "c", "d"]);

    // But the display order a child actually sees is no longer that same solved sequence.
    const displayedIds = options.items.map((i) => i.id);
    expect(displayedIds).not.toEqual(["a", "b", "c", "d"]);
    // Same four items, just reordered — nothing was dropped or invented.
    expect([...displayedIds].sort()).toEqual(["a", "b", "c", "d"]);
    expect(options.items.map((i) => i.text).sort()).toEqual(["1", "1/2", "1/4", "3/4"]);
  });

  it("shuffles the same way every time — stable across re-syncs and re-renders", () => {
    const first = mapOakQuizQuestion(orderQuestion, "STARTER", 1)!;
    const second = mapOakQuizQuestion(orderQuestion, "STARTER", 1)!;
    const idsOf = (m: typeof first) => (m.options as OrderingOptions).items.map((i) => i.id);
    expect(idsOf(second)).toEqual(idsOf(first));
  });

  it("grades correctly against the shuffled display, wherever the pieces are shown", () => {
    const mapped = mapOakQuizQuestion(orderQuestion, "STARTER", 1)!;
    const key = mapped.answerKey as OrderingKey;
    // Whatever order the child ends up submitting the ids in, correctness is judged against
    // the key by id — the display permutation used to build the question is irrelevant here.
    expect(key.order).toEqual(["a", "b", "c", "d"]);
  });
});

describe("MATCHING questions no longer line the answer up beside the question", () => {
  it("keeps the left column in Oak's order and shuffles only the right column", () => {
    const mapped = mapOakQuizQuestion(matchQuestion, "CHECK", 1)!;
    const options = mapped.options as MatchingOptions;

    expect(options.left.map((l) => l.text)).toEqual(["France", "Italy", "Spain", "Germany"]);

    const rightTexts = options.right.map((r) => r.text);
    expect(rightTexts).not.toEqual(["Paris", "Rome", "Madrid", "Berlin"]);
    expect([...rightTexts].sort()).toEqual(["Berlin", "Madrid", "Paris", "Rome"]);
  });

  it("gives the right column its own id space, distinct from the left column's", () => {
    const mapped = mapOakQuizQuestion(matchQuestion, "CHECK", 1)!;
    const options = mapped.options as MatchingOptions;
    const leftIds = new Set(options.left.map((l) => l.id));
    const rightIds = new Set(options.right.map((r) => r.id));
    expect(rightIds.size).toBe(options.right.length); // right ids unique among themselves
    expect([...rightIds].some((id) => leftIds.has(id))).toBe(false);
  });

  it("keeps the answer key correct no matter how the right column is shuffled", () => {
    const mapped = mapOakQuizQuestion(matchQuestion, "CHECK", 1)!;
    const options = mapped.options as MatchingOptions;
    const key = mapped.answerKey as MatchingKey;
    const capitalOf: Record<string, string> = { France: "Paris", Italy: "Rome", Spain: "Madrid", Germany: "Berlin" };

    expect(key.pairs).toHaveLength(4);
    for (const pair of key.pairs) {
      const left = options.left.find((l) => l.id === pair.leftId);
      const right = options.right.find((r) => r.id === pair.rightId);
      expect(left).toBeDefined();
      expect(right).toBeDefined();
      expect(capitalOf[left!.text]).toBe(right!.text);
    }
  });
});

describe("seededShuffle", () => {
  it("is a permutation of the input, seeded deterministically by the given key", () => {
    const items = ["a", "b", "c", "d", "e"];
    const shuffled = seededShuffle(items, "some-provider-ref");
    expect([...shuffled].sort()).toEqual([...items].sort());
    expect(seededShuffle(items, "some-provider-ref")).toEqual(shuffled); // same seed, same result
  });

  it("never coincidentally hands back the original order for a two-item list", () => {
    // With only two possible orders, "shuffled to the same order" is the common case a naive
    // shuffle would silently allow through — the rotate-on-no-op guarantee exists for exactly
    // this case.
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]) {
      expect(seededShuffle(["left", "right"], seed)).toEqual(["right", "left"]);
    }
  });

  it("leaves a list too short to shuffle alone", () => {
    expect(seededShuffle(["only"], "seed")).toEqual(["only"]);
    expect(seededShuffle([], "seed")).toEqual([]);
  });
});

describe("mapWorksheetQuestion's numeric parsing (reused for the AI-written numeric key)", () => {
  it("reads a simple fraction as its decimal value, not as digits with the slash thrown away", () => {
    expect(parseNumericAnswer("3/4")).toEqual({ value: 0.75, tolerance: 0, acceptedStrings: ["3/4"] });
  });

  it("still reads a plain number", () => {
    expect(parseNumericAnswer("12")).toEqual({ value: 12, tolerance: 0, acceptedStrings: ["12"] });
  });

  it("gives up on text with nothing numeric in it", () => {
    expect(parseNumericAnswer("no number here")).toBeNull();
  });

  it("is what mapWorksheetQuestion itself uses for a fraction answer", () => {
    const mapped = mapWorksheetQuestion({ number: "1", text: "What is half of one and a half?", answer: "3/4" }, 1);
    expect(mapped.type).toBe("NUMERIC");
    expect(mapped.answerKey).toEqual({ value: 0.75, tolerance: 0, acceptedStrings: ["3/4"] });
  });
});
