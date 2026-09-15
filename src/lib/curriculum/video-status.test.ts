import { describe, expect, it } from "vitest";
import { isPlaceholderUrl, isPlayableResource, isPlayableUrl } from "./video-status";

describe("isPlayableUrl", () => {
  it("accepts an https address", () => {
    expect(isPlayableUrl("https://open-api.thenational.academy/video.mp4")).toBe(true);
  });

  it("accepts an http address", () => {
    expect(isPlayableUrl("http://example.com/video.mp4")).toBe(true);
  });

  it("accepts a bare path with no scheme, resolved server-side against the provider", () => {
    expect(isPlayableUrl("lessons/halving/assets/video")).toBe(true);
    expect(isPlayableUrl("/lessons/halving/assets/video")).toBe(true);
  });

  it("rejects a fixture:// placeholder", () => {
    expect(isPlayableUrl("fixture://video/halving")).toBe(false);
  });

  it("rejects any other made-up scheme", () => {
    expect(isPlayableUrl("s3://bucket/video.mp4")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isPlayableUrl("")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isPlayableUrl(null)).toBe(false);
    expect(isPlayableUrl(undefined)).toBe(false);
  });
});

describe("isPlayableResource", () => {
  it("is playable when a file was actually stored, whatever the provider URL says", () => {
    expect(isPlayableResource({ storedPath: "/storage/assets/l/VIDEO.mp4", providerUrl: "fixture://video/x" })).toBe(
      true,
    );
  });

  it("falls back to the provider URL when there is no stored file", () => {
    expect(isPlayableResource({ storedPath: null, providerUrl: "https://example.com/v.mp4" })).toBe(true);
    expect(isPlayableResource({ storedPath: null, providerUrl: "fixture://video/x" })).toBe(false);
    expect(isPlayableResource({ storedPath: null, providerUrl: null })).toBe(false);
  });
});

describe("isPlaceholderUrl", () => {
  it("recognises the bundled sample curriculum's placeholder scheme", () => {
    expect(isPlaceholderUrl("fixture://video/halving")).toBe(true);
    expect(isPlaceholderUrl("FIXTURE://video/halving")).toBe(true);
  });

  it("is false for a real address, an empty string, or nothing", () => {
    expect(isPlaceholderUrl("https://example.com/v.mp4")).toBe(false);
    expect(isPlaceholderUrl("")).toBe(false);
    expect(isPlaceholderUrl(null)).toBe(false);
    expect(isPlaceholderUrl(undefined)).toBe(false);
  });
});
