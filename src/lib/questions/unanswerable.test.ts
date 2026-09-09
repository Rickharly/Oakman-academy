import { describe, expect, it } from "vitest";
import { isUnanswerableWithoutPicture } from "./unanswerable";

const withoutPicture = (prompt: string) => ({ prompt, promptImage: null, options: null });

/**
 * A question about a picture, with no picture, is not a hard question — it is an impossible one.
 * A child cannot tell the difference, so they guess, get it wrong, and the app records that as
 * something they do not understand.
 */
describe("questions that cannot be answered without a picture", () => {
  it("catches the ones that sent Eva looking for a table that was not there", () => {
    expect(isUnanswerableWithoutPicture(withoutPicture("What is the missing place value heading?"))).toBe(true);
    expect(isUnanswerableWithoutPicture(withoutPicture("Which shape shown below is a quadrilateral?"))).toBe(true);
    expect(isUnanswerableWithoutPicture(withoutPicture("Read the value from the diagram above."))).toBe(true);
    expect(isUnanswerableWithoutPicture(withoutPicture("What does this table tell you?"))).toBe(true);
  });

  it("leaves questions that can be answered from words alone", () => {
    // Wrongly hiding a good question is its own harm — it thins a quiz and the child is
    // assessed on less than they should be.
    expect(isUnanswerableWithoutPicture(withoutPicture("Describe the water cycle."))).toBe(false);
    expect(isUnanswerableWithoutPicture(withoutPicture("What is 3/4 of 20?"))).toBe(false);
    expect(isUnanswerableWithoutPicture(withoutPicture("Explain why 2/4 and 1/2 are equivalent."))).toBe(false);
  });

  it("keeps a picture question when the picture is actually there", () => {
    expect(
      isUnanswerableWithoutPicture({
        prompt: "What is the missing place value heading?",
        promptImage: { url: "https://example.com/table.png", alt: "A place value table" },
        options: null,
      }),
    ).toBe(false);
  });

  it("keeps it when the answers themselves are the pictures", () => {
    expect(
      isUnanswerableWithoutPicture({
        prompt: "Which shape shown below is a quadrilateral?",
        promptImage: null,
        options: { choices: [{ id: "a", text: "square", image: { url: "https://example.com/sq.png" } }] },
      }),
    ).toBe(false);
  });
});
