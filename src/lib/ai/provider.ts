/**
 * AI provider abstraction (spec §45-50, ARCHITECTURE §6). Everything the app does
 * with an LLM goes through this interface; concrete implementations live in
 * `openai-provider.ts` (OpenAI Responses API), `deepseek-provider.ts` (DeepSeek's
 * OpenAI-compatible Chat Completions API) and `mock-provider.ts` (deterministic,
 * used whenever `AI_PROVIDER` is not a real provider and in every test).
 */
import type { z } from "zod";
import { DeepSeekProvider } from "./deepseek-provider";
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
  readonly name: "openai" | "deepseek" | "mock";
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

/**
 * The model every AI call uses unless an environment variable overrides it. Deliberately
 * the cheapest capable model — the app must not spend more than it has to.
 */
const DEFAULT_MODEL = "gpt-4.1-mini";

/**
 * Resolves the concrete OpenAI model id for a request tier.
 *
 * "strong" -> OPENAI_MODEL_STRONG, else OPENAI_MODEL, else gpt-4.1-mini.
 * "fast"   -> OPENAI_MODEL_FAST,   else OPENAI_MODEL, else gpt-4.1-mini.
 *
 * `OPENAI_MODEL` is a single override for both tiers; the two per-tier variables
 * override one tier each.
 */
export function resolveModelId(model: "fast" | "strong"): string {
  const shared = process.env.OPENAI_MODEL;
  if (model === "strong") return process.env.OPENAI_MODEL_STRONG || shared || DEFAULT_MODEL;
  return process.env.OPENAI_MODEL_FAST || shared || DEFAULT_MODEL;
}

let mockSingleton: AiProvider | undefined;
let openaiSingleton: AiProvider | undefined;
let deepseekSingleton: AiProvider | undefined;
let warnedFallback = false;

/**
 * `AI_PROVIDER` env: "openai" | "deepseek" | "mock". Defaults to mock (unset, or any
 * value other than the two real providers). If a real provider is requested but its
 * API key is missing, falls back to the mock provider with a one-time console.warn —
 * the app must never crash for lack of a key.
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

  if (requested === "deepseek") {
    if (!process.env.DEEPSEEK_API_KEY) {
      if (!warnedFallback) {
        console.warn(
          "[ai] AI_PROVIDER=deepseek but DEEPSEEK_API_KEY is not set; falling back to the mock AI provider.",
        );
        warnedFallback = true;
      }
      return (mockSingleton ??= new MockProvider());
    }
    return (deepseekSingleton ??= new DeepSeekProvider());
  }

  return (mockSingleton ??= new MockProvider());
}
