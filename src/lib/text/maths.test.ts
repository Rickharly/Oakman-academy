import { describe, expect, it } from "vitest";
import { plainMaths, plainMathsDeep, spokenMaths } from "./maths";

describe("maths a child can read", () => {
  it("takes the dollar signs off a fraction", () => {
    expect(plainMaths("What is $$\\frac{3}{4}$$ of 12?")).toBe("What is 3/4 of 12?");
  });

  it("handles every delimiter the providers use", () => {
    expect(plainMaths("\\(\\frac{1}{2}\\) and \\[\\frac{1}{4}\\] and $\\frac{2}{3}$")).toBe("1/2 and 1/4 and 2/3");
  });

  it("writes every fraction the same way, so two of them can be compared", () => {
    expect(plainMaths("$\\frac{7}{9}$")).toBe("7/9");
    expect(plainMaths("$\\frac{x+1}{2}$")).toBe("(x+1)/2");
  });

  it("keeps the maths symbols people actually write", () => {
    expect(plainMaths("$6 \\times 7 = 42$")).toBe("6 × 7 = 42");
    expect(plainMaths("$12 \\div 3 \\leq 5$")).toBe("12 ÷ 3 ≤ 5");
    expect(plainMaths("$x^{2} + 3x$")).toBe("x² + 3x");
    expect(plainMaths("$\\sqrt{9} = 3$")).toBe("√9 = 3");
    expect(plainMaths("Water is $H_{2}O$")).toBe("Water is H₂O");
  });

  it("keeps the words out of \\text and drops the command", () => {
    expect(plainMaths("$\\frac{3}{4} \\text{ of the cake}$")).toBe("3/4 of the cake");
  });

  it("leaves ordinary writing exactly as it is", () => {
    const prose = "Eva, look at the picture. How many apples are there? Count them all.";
    expect(plainMaths(prose)).toBe(prose);
  });

  it("leaves a price alone — a maths delimiter comes in a pair", () => {
    expect(plainMaths("The book costs $5 and the pen costs 2 pounds.")).toBe(
      "The book costs $5 and the pen costs 2 pounds.",
    );
  });

  it("clears markdown nothing on the page renders", () => {
    expect(plainMaths("A **half** is one of `two` equal parts.")).toBe("A half is one of two equal parts.");
  });

  it("does not leave a stray backslash or brace behind", () => {
    const out = plainMaths("$$\\left( \\frac{1}{2} \\right) \\quad \\text{is a half}$$");
    expect(out).not.toMatch(/[\\{}$]/);
    expect(out).toBe("( 1/2 ) is a half");
  });

  it("reaches every string in a lesson, whatever shape it is in", () => {
    const lesson = {
      intro: "Today: $\\frac{1}{2}$",
      sections: [{ heading: "Halves", body: "Cut it into $2$ equal parts." }],
      minutes: 20,
    };
    expect(plainMathsDeep(lesson)).toEqual({
      intro: "Today: 1/2",
      sections: [{ heading: "Halves", body: "Cut it into 2 equal parts." }],
      minutes: 20,
    });
  });

  it("says it the way a teacher says it", () => {
    expect(spokenMaths("$$\\frac{3}{4}$$ of 12")).toBe("three quarters of 12");
    expect(spokenMaths("$6 \\times 7$")).toBe("6 times 7");
    expect(spokenMaths("$\\sqrt{9}$")).toBe("the square root of 9");
    expect(spokenMaths("$5^{2}$")).toBe("5 squared");
  });
});

describe("saying fractions out loud", () => {
  it("uses the words a person uses", () => {
    expect(spokenMaths("1/2 of 10")).toBe("one half of 10");
    expect(spokenMaths("2/3 of the class")).toBe("two thirds of the class");
    expect(spokenMaths("7/9 of it")).toBe("seven over nine of it");
  });
});
