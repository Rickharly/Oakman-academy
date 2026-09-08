import { describe, expect, it } from "vitest";
import { createOakClient, oakGet, OakRateLimitError } from "./client";

/**
 * The quota is a fixed budget. These tests are about not spending it stupidly — a retry on a
 * 429 does not wait for more budget, it spends what little is left.
 */
function respondWith(status: number, headers: Record<string, string> = {}) {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ message: "Rate limited exceeded" }), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

describe("when the quota is gone", () => {
  it("does not retry a 429 — one request in, one request spent", async () => {
    const { fetchImpl, calls } = respondWith(429, {
      "x-ratelimit-limit": "1000",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Date.now() + 45 * 60_000),
    });
    const client = createOakClient({ apiKey: "test", fetch: fetchImpl });

    await expect(oakGet(client, "/subjects")).rejects.toBeInstanceOf(OakRateLimitError);
    expect(calls()).toBe(1);
  });

  it("does not retry a 429 that arrives with no rate-limit headers either", async () => {
    const { fetchImpl, calls } = respondWith(429);
    const client = createOakClient({ apiKey: "test", fetch: fetchImpl });

    await expect(oakGet(client, "/subjects")).rejects.toThrow();
    expect(calls()).toBe(1);
  });

  it("says when the quota comes back, in the family's own time", async () => {
    const reset = Date.now() + 30 * 60_000;
    const { fetchImpl } = respondWith(429, {
      "x-ratelimit-limit": "1000",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(reset),
    });
    const client = createOakClient({ apiKey: "test", fetch: fetchImpl });

    const error = await oakGet(client, "/subjects").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OakRateLimitError);
    // Not UTC: a reset time in a timezone the family does not live in helps nobody.
    expect((error as Error).message).not.toMatch(/UTC/);
    expect((error as Error).message).toMatch(/Quota resets at \d{2}:\d{2}/);
  });
});
