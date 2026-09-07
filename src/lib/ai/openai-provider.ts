/**
 * Real `AiProvider` backed by the OpenAI Responses API (openai SDK ^7.10). There is
 * no network access to OpenAI from this sandbox, so this file is written carefully
 * against the SDK's shipped types and docs (node_modules/openai/README.md, and the
 * Responses resource at node_modules/openai/src/resources/responses/responses.ts) and
 * is exercised only via `MockProvider` in tests — never instantiated there.
 *
 * - `structured()` uses `client.responses.parse()` with `text.format: zodTextFormat(...)`
 *   for validated structured output (README "Structured outputs" pattern).
 * - `stream()` uses `client.responses.create({ ..., stream: true })`, reading raw SSE
 *   events (`response.output_text.delta`, `response.output_item.done`,
 *   `response.completed`) and manually running the function-tool-call loop (the
 *   Responses API does not execute tools itself) for up to 4 rounds.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { Response, ResponseInputItem, Tool } from "openai/resources/responses/responses";
import { AiError, resolveModelId } from "./provider";
import type { AiProvider, ChatMessage, StreamEvent, StreamRequest, StructuredRequest, ToolDefinition } from "./provider";

const MAX_TOOL_ROUNDS = 4;

function toInputItems(messages: ChatMessage[]): ResponseInputItem[] {
  return messages.map((m) => ({ type: "message", role: m.role, content: m.content }));
}

function toResponsesTool(tool: ToolDefinition): Tool {
  const parameters = z.toJSONSchema(tool.parameters, { target: "draft-7" }) as Record<string, unknown>;
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters,
    strict: false,
  };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;

  constructor(client?: OpenAI) {
    this.client = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async structured<T>(
    req: StructuredRequest<T>,
  ): Promise<{ data: T; model: string; tokensIn?: number; tokensOut?: number }> {
    const model = resolveModelId(req.model);
    try {
      const response = await this.client.responses.parse({
        model,
        instructions: req.system,
        input: toInputItems(req.messages),
        text: { format: zodTextFormat(req.schema, req.schemaName) },
      });

      if (response.output_parsed === null) {
        throw new AiError(`OpenAI returned no parsable output for schema "${req.schemaName}".`);
      }

      return {
        data: response.output_parsed,
        model: response.model ?? model,
        tokensIn: response.usage?.input_tokens,
        tokensOut: response.usage?.output_tokens,
      };
    } catch (err) {
      if (err instanceof AiError) throw err;
      throw new AiError(`OpenAI structured request failed (schema "${req.schemaName}").`, err);
    }
  }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    const model = resolveModelId(req.model);
    const toolDefs = req.tools ?? [];
    const tools = toolDefs.map(toResponsesTool);

    let input: ResponseInputItem[] = toInputItems(req.messages);
    let roundsLeft = MAX_TOOL_ROUNDS;
    let finalModel = model;
    let tokensIn = 0;
    let tokensOut = 0;

    for (;;) {
      let finalResponse: Response | undefined;
      const functionCalls = new Map<string, { name: string; call_id: string; arguments: string }>();

      try {
        const eventStream = await this.client.responses.create({
          model,
          instructions: req.system,
          input,
          tools: tools.length ? tools : undefined,
          stream: true,
        });

        for await (const event of eventStream) {
          if (event.type === "response.output_text.delta") {
            yield { type: "text", text: event.delta };
          } else if (event.type === "response.output_item.done" && event.item.type === "function_call") {
            functionCalls.set(event.item.call_id, {
              name: event.item.name,
              call_id: event.item.call_id,
              arguments: event.item.arguments,
            });
          } else if (event.type === "response.completed") {
            finalResponse = event.response;
          } else if (event.type === "response.failed" || event.type === "response.incomplete") {
            const reason = event.response.error?.message ?? event.response.incomplete_details?.reason ?? event.type;
            throw new AiError(`OpenAI response did not complete: ${reason}`);
          }
        }
      } catch (err) {
        if (err instanceof AiError) throw err;
        throw new AiError("OpenAI stream request failed.", err);
      }

      if (finalResponse) {
        finalModel = finalResponse.model ?? finalModel;
        tokensIn += finalResponse.usage?.input_tokens ?? 0;
        tokensOut += finalResponse.usage?.output_tokens ?? 0;
      }

      if (functionCalls.size === 0 || roundsLeft <= 0) break;
      roundsLeft -= 1;

      const nextItems: ResponseInputItem[] = [];
      for (const call of functionCalls.values()) {
        nextItems.push({ type: "function_call", call_id: call.call_id, name: call.name, arguments: call.arguments });

        const tool = toolDefs.find((t) => t.name === call.name);
        const args = safeJsonParse(call.arguments);
        let result: unknown;
        if (!tool) {
          result = { error: `Unknown tool "${call.name}".` };
        } else {
          try {
            const parsedArgs = tool.parameters.parse(args);
            result = await tool.execute(parsedArgs);
          } catch (err) {
            result = { error: err instanceof Error ? err.message : String(err) };
          }
        }

        yield { type: "tool_call", name: call.name, args, result };
        nextItems.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: typeof result === "string" ? result : JSON.stringify(result),
        });
      }

      input = [...input, ...nextItems];
    }

    yield {
      type: "done",
      model: finalModel,
      tokensIn: tokensIn || undefined,
      tokensOut: tokensOut || undefined,
    };
  }
}
