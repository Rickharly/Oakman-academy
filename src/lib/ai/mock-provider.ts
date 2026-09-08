/**
 * Deterministic, fast, offline stand-in for `OpenAiProvider`. Used whenever
 * `AI_PROVIDER !== "openai"` (the default) and in every test — this repo has no
 * network access to OpenAI, so `MockProvider` is what actually exercises the AI
 * call sites end to end.
 */
import { z } from "zod";
import type { AiProvider, ChatMessage, StreamEvent, StreamRequest, StructuredRequest, ToolDefinition } from "./provider";

function modelIdFor(model: "fast" | "strong"): string {
  return model === "strong" ? "mock-strong" : "mock-fast";
}

function stopWords(): Set<string> {
  return new Set([
    "the", "a", "an", "is", "are", "was", "were", "of", "to", "and", "in", "on", "for",
    "it", "that", "this", "with", "as", "at", "by", "be", "or", "so", "than", "then",
  ]);
}

/** Lower-cased, punctuation-stripped, stop-word-free keyword set. */
function keywordsOf(text: string): Set<string> {
  const stop = stopWords();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  return new Set(words);
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / a.size;
}

function lastUserContent(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return messages.at(-1)?.content ?? "";
}

/** Best-effort extraction of "STUDENT ANSWER: ..." and "expected answer / model
 * answer: ..." style lines out of the composed system prompt, so the mock grader has
 * something plausible to compare without needing real structured request context. */
function extractField(system: string, label: RegExp): string | null {
  const match = system.match(label);
  return match ? match[1].trim() : null;
}

function buildMockGrade(system: string, messages: ChatMessage[]) {
  const studentAnswer =
    extractField(system, /STUDENT ANSWER:\s*(.+)/i) ?? lastUserContent(messages) ?? "";
  const modelAnswer =
    extractField(system, /(?:MODEL ANSWER|EXPECTED ANSWER):\s*(.+)/i) ??
    extractField(system, /KEY LEARNING POINTS?:\s*(.+)/i) ??
    "";

  const answerWords = keywordsOf(modelAnswer);
  const overlap = overlapRatio(answerWords, keywordsOf(studentAnswer));
  const hasAnswer = studentAnswer.trim().length > 0;

  if (hasAnswer && (answerWords.size === 0 || overlap >= 0.6)) {
    return {
      score: 1,
      maxScore: 1,
      correct: true,
      mastery: 0.9,
      feedbackForStudent: "Well done — that shows a solid understanding.",
      reasoningForParent: "Mock grading: the student's answer covers the key ideas expected here.",
      misconceptions: [] as string[],
      needsReview: false,
    };
  }

  return {
    score: hasAnswer ? 0.3 : 0,
    maxScore: 1,
    correct: false,
    mastery: hasAnswer ? 0.4 : 0.1,
    feedbackForStudent: hasAnswer
      ? "You're on the right track, but a couple of things are missing — have another go."
      : "Have a go at answering this one, even a partial idea helps.",
    reasoningForParent: "Mock grading: the student's answer only partly overlaps with what was expected.",
    misconceptions: hasAnswer ? ["Possible gap in understanding — worth a follow-up question."] : [],
    needsReview: true,
  };
}

function fakeDataFor(schemaName: string, system: string, messages: ChatMessage[]): unknown {
  const lessonTitle = extractField(system, /LESSON:\s*(.+)/i) ?? "today's lesson";

  switch (schemaName) {
    case "grade":
      return buildMockGrade(system, messages);
    case "lessonSummary":
      return {
        forStudent: `You worked hard on ${lessonTitle} today — well done for sticking with it.`,
        forParent: `Completed ${lessonTitle}. Engagement was steady; a couple of areas are worth a quick review.`,
        misconceptions: [] as string[],
      };
    case "daySummary":
      return {
        content: "A solid day of learning across a few subjects, with good effort throughout.",
        data: { lessonsCompleted: 1, minutes: 45, recommendations: [] as string[] },
      };
    case "practice":
      return {
        questions: [1, 2, 3].map((n) => ({
          type: "SHORT_ANSWER" as const,
          prompt: `Practice question ${n} for ${lessonTitle}.`,
          accepted: ["answer"],
          modelAnswer: "answer",
        })),
      };
    case "misconceptions":
      return {
        observations: [
          {
            kind: "DEVELOPING" as const,
            topic: `${lessonTitle}: a recurring sticking point`,
            detail: "The student is close but is making a consistent small error worth watching.",
            confidence: 0.6,
          },
        ],
      };
    case "readingResponse": {
      // Echoes a few of the child's own words back, so a test can prove their writing
      // actually reached the teacher.
      const written = (messages[messages.length - 1]?.content ?? "").split('"""')[3]?.trim() ?? "";
      const opening = written.split(/\s+/).slice(0, 6).join(" ");
      return {
        feedback: `I liked where you said "${opening}…". What made you think that? Look again at the part just before it.`,
        reasoning: "Short reading-journal response; engaged with the text and offered an opinion.",
        strengths: ["gave an opinion about the text"],
        nextSteps: ["point to the words that gave you the idea"],
      };
    }
    case "readingEssay": {
      const written = (messages[messages.length - 1]?.content ?? "").split('"""')[3]?.trim() ?? "";
      const words = written.split(/\s+/).filter(Boolean).length;
      // Longer, more developed pieces score higher — enough for a test to tell them apart.
      const score = Math.max(1, Math.min(8, Math.round(words / 20)));
      return {
        score,
        feedback: "You make a clear point and back it up. Next time, use a short quotation to prove it.",
        reasoning: `Essay of about ${words} words; argument present, evidence use developing.`,
        strengths: ["clear point", "own voice"],
        nextSteps: ["quote directly from the text"],
      };
    }
    case "chapterPrompts": {
      const body = messages.map((m) => m.content).join("\n");
      const firstWords = body.trim().split(/\s+/).slice(0, 6).join(" ");
      return {
        prompts: [
          `What happens at the start, where it says "${firstWords}…"?`,
          "Why do you think the characters behave the way they do here?",
          "What did you make of this chapter?",
        ],
        vocabulary: [{ word: "marram", meaning: "a tough grass that grows on sand dunes" }],
      };
    }
    case "subjectReportNote": {
      // Echoes real unit titles back, so a test can tell a grounded note from a generic one.
      const body = messages.map((m) => m.content).join("\n");
      const topics = (body.match(/^- ([^:]+):/gm) ?? []).map((t: string) => t.slice(2, -1)).slice(0, 3);
      return {
        note:
          `Has worked through ${topics.join(", ") || "the material"} and can explain the steps ` +
          "aloud. Next, applying the same reasoning to unfamiliar problems without prompting.",
        strongest: topics.slice(0, 2),
        needsWork: topics.slice(2, 3),
      };
    }
    case "worksheet":
      return {
        questions: [
          {
            stage: "PRACTICE" as const,
            order: 1,
            type: "SHORT_ANSWER" as const,
            prompt: "Sample extracted worksheet question.",
            answerKey: { accepted: ["sample"], caseSensitive: false },
            maxScore: 1,
            gradingMode: "DETERMINISTIC" as const,
            providerRef: "mock-worksheet-1",
          },
        ],
      };
    default:
      return {};
  }
}

export class MockProvider implements AiProvider {
  readonly name = "mock" as const;

  async structured<T>(req: StructuredRequest<T>): Promise<{ data: T; model: string; tokensIn?: number; tokensOut?: number }> {
    const raw = fakeDataFor(req.schemaName, req.system, req.messages);
    // Parse with the caller's schema so the mock always returns a genuinely valid shape;
    // if the fake doesn't fit (an unrecognised schemaName), fall back to a best-effort
    // empty object coerced through the schema so callers still get something type-correct.
    const parsed = req.schema.safeParse(raw);
    const data = parsed.success ? parsed.data : req.schema.parse(coerceFallback(req.schema, raw));
    return {
      data,
      model: modelIdFor(req.model),
      tokensIn: 0,
      tokensOut: 0,
    };
  }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    const lessonTitle = extractField(req.system, /LESSON:\s*(.+)/i);
    const questionPrompt =
      extractField(req.system, /question:\s*"([^"]*)"/i) ?? extractField(req.system, /QUESTION:\s*(.+)/i);
    const isAssessment = /MODE:\s*ASSESSMENT/i.test(req.system);
    const userMessage = lastUserContent(req.messages);

    const parts: string[] = [];
    if (isAssessment) {
      parts.push("I can't give you the answer, but I can help you work it out.");
    }
    if (lessonTitle) {
      parts.push(`Thinking about ${lessonTitle}:`);
    }
    if (questionPrompt) {
      parts.push(`On "${questionPrompt}" — what have you tried so far?`);
    }
    parts.push(userMessage ? `You said: "${userMessage}". Let's break that down together.` : "What would you like help with?");

    // Optionally exercise one tool call so tests can assert tool plumbing works, when
    // a getRecentErrors-style tool is offered and the user is asking about mistakes.
    const errorTool = (req.tools ?? []).find((t) => /error|mistake/i.test(t.name));
    if (errorTool && /wrong|mistake|error/i.test(userMessage)) {
      const args = safeToolArgs(errorTool);
      const toolResult = await errorTool.execute(args);
      yield { type: "tool_call", name: errorTool.name, args, result: toolResult };
    }

    const text = parts.join(" ");
    for (const word of text.split(" ")) {
      yield { type: "text", text: word + " " };
    }

    yield { type: "done", model: modelIdFor(req.model), tokensIn: 0, tokensOut: text.split(" ").length };
  }
}

function safeToolArgs(tool: ToolDefinition): unknown {
  const parsed = tool.parameters.safeParse({});
  return parsed.success ? parsed.data : {};
}

function coerceFallback<T>(schema: z.ZodType<T>, raw: unknown): unknown {
  // Best-effort: return the raw value unchanged; schema.parse() will throw a clear
  // error naming the unmet field(s) if this genuinely doesn't fit, which is the
  // correct behaviour for an unrecognised schemaName rather than silently inventing
  // data that would pass validation but mean nothing.
  return raw;
}
