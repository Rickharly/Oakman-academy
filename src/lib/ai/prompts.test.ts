import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompts";

/**
 * Eva said it plainly: she tells the teacher she does not understand, and gets a couple of
 * sentences telling her what to do next. These hold the prompt to the opposite.
 */
const base = {
  studentName: "Eva",
  yearGroup: 7,
  age: 12,
  contextText: "LESSON: Fractions",
} as const;

describe("the teacher's brief", () => {
  it("tells her to explain, not to answer a confused child with a question", () => {
    const prompt = buildSystemPrompt({ ...base, mode: "LEARN" });
    expect(prompt).toMatch(/EXPLAIN\. Do not reply with only a question/);
    expect(prompt).toMatch(/worked example all the way through/);
  });

  it("does not cap her at a couple of sentences when a real explanation is needed", () => {
    const prompt = buildSystemPrompt({ ...base, mode: "LEARN" });
    // The old rule — "keep replies under about 120 words" — is what produced the complaint.
    expect(prompt).not.toMatch(/under about 120 words/);
    expect(prompt).toMatch(/three or four paragraphs/);
  });

  it("lets practice be interrupted by a child who is genuinely lost", () => {
    const prompt = buildSystemPrompt({ ...base, mode: "PRACTICE" });
    expect(prompt).toMatch(/Practice is not a reason to withhold an explanation/);
  });

  it("still never gives away an answer during an assessment", () => {
    const prompt = buildSystemPrompt({ ...base, mode: "ASSESSMENT" });
    expect(prompt).toMatch(/never reveal, confirm, or hint/);
    // Explaining more generously must not have loosened the one absolute rule.
    expect(prompt).toMatch(/Never give, confirm, deny or narrow down the answer/);
  });

  it("asks for their own world, not a textbook's", () => {
    const prompt = buildSystemPrompt({ ...base, mode: "LEARN" });
    expect(prompt).toMatch(/what they are into/);
    expect(prompt).toMatch(/Tell it as something happening, not as a definition/);
  });
});
