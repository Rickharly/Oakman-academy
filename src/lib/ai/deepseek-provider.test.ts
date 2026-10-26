/**
 * `DeepSeekProvider` is pointed at DeepSeek's OpenAI-compatible Chat Completions API, so
 * this never talks to the network: a fake `OpenAI` client is injected and the provider's
 * own logic — JSON-mode parsing for `structured()`, and the manual function-call loop for
 * `stream()` — is exercised directly.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type OpenAI from "openai";
import { DeepSeekProvider } from "./deepseek-provider";
import type { StreamEvent } from "./provider";

function fakeClient(create: unknown): OpenAI {
  return { chat: { completions: { create } } } as unknown as OpenAI;
}

function streamChunk(delta: unknown): unknown {
  return { choices: [{ delta }] };
}

async function* emptyStream(): AsyncGenerator<unknown> {
  // terminate immediately
}

describe("DeepSeekProvider.structured", () => {
  it("parses JSON-mode output through the caller's schema", async () => {
    const schema = z.object({ answer: z.string() });
    let lastArgs: unknown;
    const create = vi.fn(async (args: unknown) => {
      lastArgs = args;
      return {
        choices: [{ message: { content: '{"answer":"42"}' } }],
        model: "deepseek-v4-pro",
        usage: { prompt_tokens: 11, completion_tokens: 3 },
      };
    });

    const provider = new DeepSeekProvider(fakeClient(create));
    const { data, model, tokensIn, tokensOut } = await provider.structured({
      model: "fast",
      schemaName: "test",
      schema,
      system: "Reply as JSON.",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(data).toEqual({ answer: "42" });
    expect(model).toBe("deepseek-v4-pro");
    expect(tokensIn).toBe(11);
    expect(tokensOut).toBe(3);
    // JSON mode must be requested, and the schema serialised into the prompt.
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: "json_object" },
      }),
    );
    const system = (lastArgs as { messages: { role: string; content: string }[] }).messages[0];
    expect(system.content).toContain("answer");
  });

  it("rejects when the model returns content that fails schema validation", async () => {
    const schema = z.object({ answer: z.string() });
    const create = vi.fn(async () => ({
      choices: [{ message: { content: '{"notAnswer":"nope"}' } }],
    }));

    const provider = new DeepSeekProvider(fakeClient(create));
    await expect(
      provider.structured({
        model: "fast",
        schemaName: "test",
        schema,
        system: "Reply as JSON.",
        messages: [],
      }),
    ).rejects.toThrow(/deepseek structured request failed/i);
  });
});

describe("DeepSeekProvider.stream", () => {
  it("streams text and runs the tool loop manually", async () => {
    const tool = {
      name: "lookup",
      description: "look something up",
      parameters: z.object({ q: z.string() }),
      execute: async (args: unknown) => ({ result: (args as { q: string }).q }),
    };

    let calls = 0;
    const create = vi.fn(() => {
      calls += 1;
      if (calls > 1) return emptyStream();
      return (async function* () {
        yield streamChunk({ content: "Looking…" });
        yield streamChunk({
          tool_calls: [
            { index: 0, id: "call_1", type: "function", function: { name: "lookup", arguments: '{"q":' } },
          ],
        });
        yield streamChunk({ tool_calls: [{ index: 0, function: { arguments: '"apple"}' } }] });
      })();
    });

    const provider = new DeepSeekProvider(fakeClient(create));
    const events: StreamEvent[] = [];
    for await (const event of provider.stream({
      model: "fast",
      system: "S",
      messages: [{ role: "user", content: "go" }],
      tools: [tool],
    })) {
      events.push(event);
    }

    const text = events.find((e) => e.type === "text");
    const toolCall = events.find((e) => e.type === "tool_call");
    const done = events.find((e) => e.type === "done");

    expect(text && text.type === "text" ? text.text : "").toBe("Looking…");
    expect(toolCall).toMatchObject({ type: "tool_call", name: "lookup" });
    expect(toolCall && toolCall.type === "tool_call" ? toolCall.result : undefined).toEqual({ result: "apple" });
    expect(done).toMatchObject({ type: "done", model: "deepseek-v4-pro" });
  });
});
