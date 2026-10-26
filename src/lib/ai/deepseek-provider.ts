/**
 * Real `AiProvider` backed by DeepSeek's OpenAI-compatible Chat Completions API.
 *
 * DeepSeek does NOT implement OpenAI's Responses API (no `responses.parse`, no
 * `zodTextFormat`), so this provider is built on `client.chat.completions` instead:
 * - `structured()` uses JSON output mode (`response_format: { type: "json_object" }`)
 *   plus the zod schema serialised into the prompt, then parses and validates with the
 *   same schema the rest of the app relies on.
 * - `stream()` uses chat-completions streaming with DeepSeek's function-calling, running
 *   the tool loop manually (DeepSeek executes no tools itself).
 *
 * The OpenAI SDK is reused here; only the base URL changes (`https://api.deepseek.com`),
 * which is how `openai`-compatible providers are meant to be pointed elsewhere.
 */
import OpenAI from "openai";
import { z } from "zod";
import { AiError } from "./provider";
import type { AiProvider, ChatMessage, StreamEvent, StreamRequest, StructuredRequest, ToolDefinition } from "./provider";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";
const MAX_TOOL_ROUNDS = 4;

/** "fast"/"strong" -> DEEPSEEK_MODEL_FAST/STRONG, else DEEPSEEK_MODEL, else deepseek-chat. */
export function resolveDeepSeekModelId(model: "fast" | "strong"): string {
  const shared = process.env.DEEPSEEK_MODEL;
  if (model === "strong") return process.env.DEEPSEEK_MODEL_STRONG || shared || DEFAULT_MODEL;
  return process.env.DEEPSEEK_MODEL_FAST || shared || DEFAULT_MODEL;
}

function toChatMessages(messages: ChatMessage[]): { role: "system" | "user" | "assistant"; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** JSON object mode must be asked for in the prompt too, or DeepSeek may not comply. */
function schemaPrompt(schema: z.ZodType<unknown>): string {
  const json = JSON.stringify(z.toJSONSchema(schema, { target: "draft-2020-12" }));
  return `\n\nReply with a single JSON object and nothing else (no markdown fences). It must match this schema exactly:\n${json}`;
}

export class DeepSeekProvider implements AiProvider {
  readonly name = "deepseek" as const;
  private readonly client: OpenAI;

  constructor(client?: OpenAI) {
    this.client =
      client ??
      new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: DEEPSEEK_BASE_URL,
      });
  }

  async structured<T>(
    req: StructuredRequest<T>,
  ): Promise<{ data: T; model: string; tokensIn?: number; tokensOut?: number }> {
    const model = resolveDeepSeekModelId(req.model);
    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: req.system + schemaPrompt(req.schema as z.ZodType<unknown>) },
          ...toChatMessages(req.messages),
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const content = completion.choices[0]?.message?.content ?? "";
      const data = req.schema.parse(safeJsonParse(content));

      return {
        data,
        model: completion.model ?? model,
        tokensIn: completion.usage?.prompt_tokens,
        tokensOut: completion.usage?.completion_tokens,
      };
    } catch (err) {
      if (err instanceof AiError) throw err;
      throw new AiError(`DeepSeek structured request failed (schema "${req.schemaName}").`, err);
    }
  }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    const model = resolveDeepSeekModelId(req.model);
    const toolDefs = req.tools ?? [];
    const tools = toolDefs.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: z.toJSONSchema(t.parameters, { target: "draft-7" }),
      },
    }));

    type Msg =
      | { role: "system" | "user" | "assistant"; content: string }
      | { role: "assistant"; content: string; tool_calls: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
      | { role: "tool"; tool_call_id: string; content: string };

    const messages: Msg[] = [{ role: "system", content: req.system }, ...toChatMessages(req.messages)];

    let finalModel = model;
    let roundsLeft = MAX_TOOL_ROUNDS;

    for (;;) {
      const toolCalls = new Map<number, { id: string; name: string; args: string }>();
      let text = "";

      const stream = await this.client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: tools.length ? tools : undefined,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          text += delta.content;
          yield { type: "text", text: delta.content };
        }
        for (const tc of delta?.tool_calls ?? []) {
          const idx = tc.index ?? 0;
          const cur = toolCalls.get(idx) ?? { id: tc.id ?? "", name: "", args: "" };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          toolCalls.set(idx, cur);
        }
      }

      if (toolCalls.size === 0 || roundsLeft <= 0) break;
      roundsLeft -= 1;

      const calls = [...toolCalls.values()];
      messages.push({
        role: "assistant",
        content: text,
        tool_calls: calls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: c.args },
        })),
      });

      for (const call of calls) {
        const tool = toolDefs.find((t) => t.name === call.name);
        const args = safeJsonParse(call.args);
        let result: unknown;
        if (!tool) {
          result = { error: `Unknown tool "${call.name}".` };
        } else {
          try {
            result = await tool.execute(tool.parameters.parse(args));
          } catch (err) {
            result = { error: err instanceof Error ? err.message : String(err) };
          }
        }
        yield { type: "tool_call", name: call.name, args, result };
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: typeof result === "string" ? result : JSON.stringify(result),
        });
      }
    }

    yield { type: "done", model: finalModel };
  }
}
