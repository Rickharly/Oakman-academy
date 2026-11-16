import { describe, expect, it } from "vitest";
import { looksLikeSameQuestion, promptKey, withoutRepeats, type AlreadyRight } from "./seen";

const q = (id: string, prompt: string, stage: "STARTER" | "PRACTICE" | "CHECK" = "CHECK") => ({ id, prompt, stage });
const right = (ids: string[] = [], prompts: string[] = []): AlreadyRight => ({
  ids: new Set(ids),
  keys: new Set(prompts.map(promptKey)),
});

describe("looksLikeSameQuestion", () => {
  it("treats punctuation, case and spacing as the same question", () => {
    expect(looksLikeSameQuestion("What is 3/4 of 20?", "what is 3 4 of 20")).toBe(true);
  });

  it("treats the same question with the numbers changed as the same question", () => {
    expect(
      looksLikeSameQuestion(
        "Which of these fractions is equivalent to 1/2 of the whole shape?",
        "Which of these fractions is equivalent to 3/4 of the whole shape?",
      ),
    ).toBe(true);
  });

  it("keeps genuinely different questions apart", () => {
    expect(looksLikeSameQuestion("Name the capital city of France.", "Which river flows through Paris?")).toBe(false);
    expect(looksLikeSameQuestion("Simplify 6/8.", "Simplify 9/12.")).toBe(false); // too short to judge loosely
  });
});

describe("withoutRepeats", () => {
  it("leaves out what they already got right, by id or by the same wording", () => {
    const qs = [q("a", "Starter one", "STARTER"), q("b", "Starter two", "STARTER"), q("c", "Starter three", "STARTER")];
    const kept = withoutRepeats(qs, right(["a"], ["starter three"]), new Set());
    expect(kept.map((x) => x.id)).toEqual(["b"]);
  });

  it("keeps a question they got right if they have already answered it in this attempt", () => {
    const qs = [q("a", "One", "PRACTICE"), q("b", "Two", "PRACTICE")];
    expect(withoutRepeats(qs, right(["a", "b"]), new Set(["a"])).map((x) => x.id)).toEqual(["a"]);
  });

  it("never lets the end-of-lesson quiz drop below three questions", () => {
    const qs = ["a", "b", "c", "d", "e", "f"].map((id) => q(id, `Check ${id}`));
    const kept = withoutRepeats(qs, right(["a", "b", "c", "d", "e"]), new Set());
    // f is fresh; the earliest two already-right ones make up the number.
    expect(kept.map((x) => x.id)).toEqual(["a", "b", "f"]);
  });

  it("drops the already-right quiz questions when enough fresh ones are left", () => {
    const qs = ["a", "b", "c", "d", "e", "f"].map((id) => q(id, `Check ${id}`));
    expect(withoutRepeats(qs, right(["a", "b"]), new Set()).map((x) => x.id)).toEqual(["c", "d", "e", "f"]);
  });

  it("asks again what they got wrong — only right answers are left out", () => {
    const qs = [q("a", "Got this wrong"), q("b", "Never seen"), q("c", "Also new")];
    expect(withoutRepeats(qs, right(), new Set()).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});
