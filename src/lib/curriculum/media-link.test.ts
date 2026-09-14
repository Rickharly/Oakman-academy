import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkIsFresh, resetMediaLinkCache, resolveMedia, signedLinkExpiry } from "./media-link";

const NOW = Date.UTC(2026, 8, 14, 9, 0, 0);
const MIN = 60_000;

describe("reading when a signed link expires", () => {
  it("reads Google's date plus lifetime", () => {
    const url = "https://storage.googleapis.com/b/v.mp4?X-Goog-Date=20260914T090000Z&X-Goog-Expires=3600&X-Goog-Signature=abc";
    expect(signedLinkExpiry(url, NOW)).toBe(NOW + 60 * MIN);
  });

  it("reads Amazon's date plus lifetime", () => {
    const url = "https://b.s3.amazonaws.com/v.mp4?X-Amz-Date=20260914T090000Z&X-Amz-Expires=900&X-Amz-Signature=abc";
    expect(signedLinkExpiry(url, NOW)).toBe(NOW + 15 * MIN);
  });

  it("reads a plain unix time", () => {
    const at = Math.floor(NOW / 1000) + 1800;
    expect(signedLinkExpiry(`https://cdn.example.com/v.mp4?Expires=${at}&Signature=x`, NOW)).toBe(at * 1000);
  });

  it("reads the exp claim of a token", () => {
    const exp = Math.floor(NOW / 1000) + 600;
    const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
    const url = `https://stream.mux.com/abc/high.mp4?token=hdr.${payload}.sig`;
    expect(signedLinkExpiry(url, NOW)).toBe(exp * 1000);
  });

  it("assumes a short life when the link says nothing", () => {
    expect(signedLinkExpiry("https://cdn.example.com/v.mp4", NOW)).toBe(NOW + 20 * MIN);
  });

  it("does not believe a link that claims to last for days, or one already expired", () => {
    const far = Math.floor(NOW / 1000) + 7 * 24 * 3600;
    expect(signedLinkExpiry(`https://cdn.example.com/v.mp4?Expires=${far}`, NOW)).toBe(NOW + 6 * 60 * MIN);
    const past = Math.floor(NOW / 1000) - 10;
    expect(signedLinkExpiry(`https://cdn.example.com/v.mp4?Expires=${past}`, NOW)).toBe(NOW + 20 * MIN);
  });
});

describe("whether a remembered link is still safe to hand out", () => {
  const link = { url: "https://cdn.example.com/v.mp4", contentType: "video/mp4", acceptsRanges: true };
  it("is, well before expiry", () => {
    expect(linkIsFresh({ ...link, expiresAt: NOW + 30 * MIN }, NOW)).toBe(true);
  });
  it("is not, in the last minutes before expiry", () => {
    expect(linkIsFresh({ ...link, expiresAt: NOW + 3 * MIN }, NOW)).toBe(false);
  });
});

describe("resolving where a lesson's file is", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const calls = () => fetchMock.mock.calls.map(([input]) => String(input));

  beforeEach(() => {
    resetMediaLinkCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.OAK_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OAK_API_KEY;
  });

  const endpoint = "https://open-api.thenational.academy/api/v0/lessons/halves/assets/video";
  const signed = "https://storage.googleapis.com/oak/halves.mp4?X-Goog-Date=20990101T000000Z&X-Goog-Expires=3600";

  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }

  it("follows the endpoint to the signed link, probes it, and remembers it", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ url: signed }))
      .mockResolvedValueOnce(
        new Response("x", { status: 206, headers: { "content-type": "video/mp4", "content-range": "bytes 0-0/100" } }),
      );

    const first = await resolveMedia({ id: "r1", providerUrl: endpoint });
    expect(first.kind).toBe("link");
    if (first.kind !== "link") return;
    expect(first.link.url).toBe(signed);
    expect(first.link.contentType).toBe("video/mp4");
    expect(first.link.acceptsRanges).toBe(true);

    // The key went to the provider and nowhere else.
    const [, endpointInit] = fetchMock.mock.calls[0]!;
    expect((endpointInit?.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const [, probeInit] = fetchMock.mock.calls[1]!;
    expect((probeInit?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect((probeInit?.headers as Record<string, string>).Range).toBe("bytes=0-0");

    // Asking again costs nothing: neither the provider's quota nor the CDN is touched.
    const second = await resolveMedia({ id: "r1", providerUrl: endpoint });
    expect(second.kind).toBe("link");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("says when a host calls a video something else, or will not honour ranges", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { downloadUrl: signed } }))
      .mockResolvedValueOnce(new Response("x", { status: 200, headers: { "content-type": "application/octet-stream" } }));

    const resolved = await resolveMedia({ id: "r2", providerUrl: endpoint });
    expect(resolved.kind).toBe("link");
    if (resolved.kind !== "link") return;
    expect(resolved.link.contentType).toBeNull();
    expect(resolved.link.acceptsRanges).toBe(false);
  });

  it("hands over the endpoint's own answer when it is the file, with the range passed along", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("bytes", { status: 206, headers: { "content-type": "video/mp4", "content-range": "bytes 0-4/100" } }),
    );

    const resolved = await resolveMedia({ id: "r3", providerUrl: endpoint }, { range: "bytes=0-4" });
    expect(resolved.kind).toBe("stream");
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Range).toBe("bytes=0-4");
    expect(calls()).toEqual([endpoint]);
  });

  it("resolves a relative endpoint against the provider's base", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ url: signed }))
      .mockResolvedValueOnce(new Response("x", { status: 206, headers: { "content-type": "video/mp4" } }));

    await resolveMedia({ id: "r4", providerUrl: "/lessons/halves/assets/video" });
    expect(calls()[0]).toBe(endpoint);
  });

  it("refuses a placeholder rather than fetching it", async () => {
    await expect(resolveMedia({ id: "r5", providerUrl: "fixture://video/halves" })).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains a refused key, a copyright block, and a link that does not answer", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    await expect(resolveMedia({ id: "r6", providerUrl: endpoint })).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("OAK_API_KEY"),
    });

    fetchMock.mockResolvedValueOnce(new Response("Content is blocked for copyright reasons", { status: 400 }));
    await expect(resolveMedia({ id: "r7", providerUrl: endpoint })).rejects.toMatchObject({ status: 451 });

    fetchMock.mockResolvedValueOnce(jsonResponse({ url: signed })).mockResolvedValueOnce(new Response("", { status: 403 }));
    await expect(resolveMedia({ id: "r8", providerUrl: endpoint })).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("403"),
    });
  });

  it("asks again once a remembered link is about to expire", async () => {
    const soon = `https://storage.googleapis.com/oak/halves.mp4?Expires=${Math.floor(Date.now() / 1000) + 120}`;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ url: soon }))
      .mockResolvedValueOnce(new Response("x", { status: 206, headers: { "content-type": "video/mp4" } }))
      .mockResolvedValueOnce(jsonResponse({ url: signed }))
      .mockResolvedValueOnce(new Response("x", { status: 206, headers: { "content-type": "video/mp4" } }));

    await resolveMedia({ id: "r9", providerUrl: endpoint });
    const again = await resolveMedia({ id: "r9", providerUrl: endpoint });
    expect(again.kind === "link" && again.link.url).toBe(signed);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
