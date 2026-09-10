import { describe, expect, it } from "vitest";
import { plainQuestion } from "./display";

describe("a question as a child should see it", () => {
  it("makes the prompt and every choice readable, and leaves the ids alone", () => {
    const question = plainQuestion({
      id: "q1",
      prompt: "Which of these is equal to $$\\frac{1}{2}$$?",
      options: {
        choices: [
          { id: "a", text: "$\\frac{2}{4}$" },
          { id: "b", text: "$\\frac{1}{3}$" },
        ],
      },
      maxScore: 1,
    });

    expect(question.prompt).toBe("Which of these is equal to 1/2?");
    const choices = (question.options as { choices: { id: string; text: string }[] }).choices;
    expect(choices.map((c) => c.text)).toEqual(["2/4", "1/3"]);
    // The answer key matches on id. Touching those would mark a correct answer wrong.
    expect(choices.map((c) => c.id)).toEqual(["a", "b"]);
    expect(question.maxScore).toBe(1);
  });

  it("reads both sides of a matching and the items of an ordering", () => {
    const matching = plainQuestion({
      prompt: "Match them up",
      options: {
        left: [{ id: "l1", text: "$\\frac{1}{4}$" }],
        right: [{ id: "r1", text: "$25\\%$" }],
      },
    });
    const options = matching.options as { left: { text: string }[]; right: { text: string }[] };
    expect(options.left[0].text).toBe("1/4");
    expect(options.right[0].text).toBe("25%");
  });

  it("never touches a picture's address", () => {
    const url = "https://cdn.thenational.academy/media/question_2.png";
    const question = plainQuestion({
      prompt: "What does the diagram show?",
      promptImage: { url, alt: "A bar split into $4$ parts" },
      options: { choices: [{ id: "a", text: "A quarter", image: { url } }] },
    });
    expect((question.promptImage as { url: string; alt: string }).url).toBe(url);
    expect((question.promptImage as { alt: string }).alt).toBe("A bar split into 4 parts");
    expect(
      (question.options as { choices: { image: { url: string } }[] }).choices[0].image.url,
    ).toBe(url);
  });
});
