/**
 * AI provider abstraction (spec §45-50, ARCHITECTURE §6). Everything the app does
 * with an LLM goes through this interface; concrete implementations live in
 * `openai-provider.ts` (real, Responses API) and `mock-provider.ts` (deterministic,
 * used whenever `AI_PROVIDER !== "openai"` and in every test).
 */
import type { z } from "zod";
import { MockProvider } from "./mock-provider";
import { OpenAiProvider } from "./openai-provider";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StructuredRequest<T> {
  model: "fast" | "strong";
  system: string;
  messages: ChatMessage[];
  schema: z.ZodType<T>;
  schemaName: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<unknown>;
  execute: (args: unknown) => Promise<unknown>;
}

export interface StreamRequest {
  model: "fast" | "strong";
  system: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; args: unknown; result: unknown }
  | { type: "done"; model: string; tokensIn?: number; tokensOut?: number };

export interface AiProvider {
  readonly name: "openai" | "mock";
  structured<T>(req: StructuredRequest<T>): Promise<{ data: T; model: string; tokensIn?: number; tokensOut?: number }>;
  stream(req: StreamRequest): AsyncIterable<StreamEvent>;
}

/** Thrown for any failure talking to (or parsing the output of) an AI provider. */
export class AiError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AiError";
    this.cause = cause;
  }
}

/** "fast" -> OPENAI_MODEL_FAST (default gpt-5-mini); "strong" -> OPENAI_MODEL_STRONG (default gpt-5). */
export function resolveModelId(model: "fast" | "strong"): string {
  if (model === "strong") return process.env.OPENAI_MODEL_STRONG || "gpt-5";
  return process.env.OPENAI_MODEL_FAST || "gpt-5-mini";
}

let mockSingleton: AiProvider | undefined;
let openaiSingleton: AiProvider | undefined;
let warnedFallback = false;

/**
 * `AI_PROVIDER` env: "openai" | "mock". Defaults to mock (unset, or any value other
 * than "openai"). If "openai" is requested but `OPENAI_API_KEY` is missing, falls back
 * to the mock provider with a one-time console.warn — the app must never crash for
 * lack of a key.
 */
export function getAiProvider(): AiProvider {
  const requested = (process.env.AI_PROVIDER || "mock").toLowerCase();

  if (requested === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      if (!warnedFallback) {
        console.warn(
          "[ai] AI_PROVIDER=openai but OPENAI_API_KEY is not set; falling back to the mock AI provider.",
        );
        warnedFallback = true;
      }
      return (mockSingleton ??= new MockProvider());
    }
    return (openaiSingleton ??= new OpenAiProvider());
  }

  return (mockSingleton ??= new MockProvider());
}
