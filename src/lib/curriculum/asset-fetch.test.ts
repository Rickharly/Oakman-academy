import { describe, expect, it } from "vitest";
import { resolveAssetUrl } from "./asset-fetch";

/**
 * The provider's asset listing gives "the download endpoint for the asset", and does not promise
 * it is absolute. A relative one handed to `fetch` fails with nothing but "TypeError: fetch
 * failed" — no status, no host, no clue — and that is what a lesson's video was doing all day.
 */
describe("resolving a stored asset link", () => {
  it("leaves an absolute link alone", () => {
    expect(resolveAssetUrl("https://cdn.example.com/a.mp4")).toBe("https://cdn.example.com/a.mp4");
  });

  it("resolves a path against the provider's API base", () => {
    expect(resolveAssetUrl("/lessons/halves/assets/video")).toBe(
      "https://open-api.thenational.academy/api/v0/lessons/halves/assets/video",
    );
  });

  it("resolves one without a leading slash the same way", () => {
    expect(resolveAssetUrl("lessons/halves/assets/video")).toBe(
      "https://open-api.thenational.academy/api/v0/lessons/halves/assets/video",
    );
  });

  it("does not lose the API version segment", () => {
    // `new URL("/x", base)` would drop /api/v0 and ask the wrong host path entirely.
    expect(resolveAssetUrl("/lessons/x/assets/worksheet")).toContain("/api/v0/lessons/");
  });
});
