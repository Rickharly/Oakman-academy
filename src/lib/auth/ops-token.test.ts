import { describe, expect, it } from "vitest";
import { hasOpsReadToken } from "./ops-token";

const TOKEN = "a".repeat(40);
const req = (auth?: string) =>
  new Request("https://example.test/api/ops/diagnostics", { headers: auth ? { authorization: auth } : {} });

describe("hasOpsReadToken", () => {
  it("accepts the configured token", () => {
    expect(hasOpsReadToken(req(`Bearer ${TOKEN}`), TOKEN)).toBe(true);
  });

  it("refuses a wrong or missing token", () => {
    expect(hasOpsReadToken(req(`Bearer ${"b".repeat(40)}`), TOKEN)).toBe(false);
    expect(hasOpsReadToken(req(), TOKEN)).toBe(false);
    expect(hasOpsReadToken(req(TOKEN), TOKEN)).toBe(false);
  });

  it("is off when no token, or a short one, is configured", () => {
    expect(hasOpsReadToken(req("Bearer anything"), undefined)).toBe(false);
    expect(hasOpsReadToken(req("Bearer short"), "short")).toBe(false);
  });
});
