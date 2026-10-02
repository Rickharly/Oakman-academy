import { describe, expect, it } from "vitest";
import { sameTeaching } from "./sameness";

/**
 * "The next lesson is absolutely the same content." These hold the definition of "same" to both
 * halves of the problem: two lessons that teach the same thing are caught however they are
 * named, and two that genuinely differ are left alone — skipping a real lesson is its own harm.
 */
describe("whether two lessons teach the same thing", () => {
  it("catches the same lesson under the same name", () => {
    expect(
      sameTeaching(
        { id: "oak", title: "Adding fractions" },
        { id: "ours", title: "Adding Fractions." },
      ),
    ).toBe(true);
  });

  it("catches the same teaching under a different name", () => {
    // The case a title check alone misses: worded differently, taught identically.
    expect(
      sameTeaching(
        {
          id: "oak",
          title: "Adding fractions",
          keyLearningPoints: [
            "Fractions with the same denominator are added by adding the numerators.",
            "The denominator stays the same when adding fractions.",
            "Simplify the answer where you can.",
          ],
        },
        {
          id: "ours",
          title: "Fractions: finding the total",
          keyLearningPoints: [
            "When the denominator is the same, add the numerators.",
            "The denominator does not change when adding.",
            "Simplify the answer if possible.",
          ],
        },
      ),
    ).toBe(true);
  });

  it("leaves genuinely different lessons alone", () => {
    expect(
      sameTeaching(
        {
          id: "a",
          title: "Adding fractions",
          keyLearningPoints: ["Add numerators when denominators match.", "Simplify the answer."],
        },
        {
          id: "b",
          title: "Multiplying fractions",
          keyLearningPoints: ["Multiply the numerators together.", "Multiply the denominators together."],
        },
      ),
    ).toBe(false);
  });

  it("catches a reworded science lesson", () => {
    expect(
      sameTeaching(
        {
          id: "oak",
          title: "Photosynthesis",
          keyLearningPoints: [
            "Plants make glucose using light energy.",
            "Photosynthesis needs carbon dioxide and water.",
            "Oxygen is released as a by-product.",
          ],
        },
        {
          id: "ours",
          title: "How plants make food",
          keyLearningPoints: [
            "Photosynthesis uses light to make glucose.",
            "Water and carbon dioxide are needed.",
            "Oxygen is given off.",
          ],
        },
      ),
    ).toBe(true);
  });

  it("keeps neighbouring history topics apart", () => {
    expect(
      sameTeaching(
        {
          id: "a",
          title: "The Romans in Britain",
          keyLearningPoints: ["The Romans invaded Britain in 43 AD.", "Roman roads and towns changed Britain."],
        },
        {
          id: "b",
          title: "The Vikings in Britain",
          keyLearningPoints: ["The Vikings raided Britain from 793.", "Viking settlements in the Danelaw."],
        },
      ),
    ).toBe(false);
  });

  it("keeps two fraction lessons apart when they teach different methods", () => {
    expect(
      sameTeaching(
        {
          id: "a",
          title: "Equivalent fractions",
          keyLearningPoints: ["Equivalent fractions have the same value.", "Multiply numerator and denominator by the same number."],
        },
        {
          id: "b",
          title: "Comparing fractions",
          keyLearningPoints: ["Compare fractions with different denominators.", "Find a common denominator to compare."],
        },
      ),
    ).toBe(false);
  });

  it("does not call two different topics in one unit the same because they share a word", () => {
    expect(
      sameTeaching(
        { id: "a", title: "The Romans in Britain" },
        { id: "b", title: "The Vikings in Britain" },
      ),
    ).toBe(false);
  });

  it("keeps numbered parts of a sequence apart", () => {
    // The digit is often the only thing that distinguishes two lessons in order. Dropping it
    // would make every part after the first look like a repeat and skip it.
    expect(sameTeaching({ id: "a", title: "Fractions 1" }, { id: "b", title: "Fractions 2" })).toBe(false);
    expect(sameTeaching({ id: "a", title: "maths lesson 1" }, { id: "b", title: "maths lesson 2" })).toBe(false);
  });

  it("does not decide on one vague learning point each", () => {
    // Two lessons with one thin point apiece prove nothing either way; the title has to agree.
    expect(
      sameTeaching(
        { id: "a", title: "Persuasive writing", keyLearningPoints: ["Write well."] },
        { id: "b", title: "Writing a story", keyLearningPoints: ["Write well."] },
      ),
    ).toBe(false);
  });
});
