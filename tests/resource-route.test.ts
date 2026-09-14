import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { resetMediaLinkCache } from "@/lib/curriculum/media-link";
import { GET } from "@/app/api/curriculum/resources/[resourceId]/route";
import { resetDb } from "./helpers/db";

/**
 * What a child's iPad is actually handed when the player asks for a lesson's video.
 *
 * The player used to be answered by the server downloading the whole file first, and by a
 * plain 200 with no range support when that failed — which Safari will not play. These tests
 * pin the new contract: the browser is sent to the signed link when the link is fit for a
 * player, and gets a relabelled, range-honouring proxy when it is not.
 */

const ENDPOINT = "https://open-api.thenational.academy/api/v0/lessons/halves/assets/video";
const SIGNED = "https://storage.googleapis.com/oak/halves.mp4?X-Goog-Date=20990101T000000Z&X-Goog-Expires=3600";

async function createTestSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: { tokenHash, userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  return token;
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("serving a lesson's video to the player", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let token: string;
  let resourceId: string;
  let placeholderId: string;

  beforeEach(async () => {
    await resetDb();
    resetMediaLinkCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.OAK_API_KEY = "test-key";

    const passwordHash = await hashPassword("1234");
    const user = await prisma.user.create({
      data: { role: Role.STUDENT, username: "eva", passwordHash, displayName: "Eva", avatar: "🦊" },
    });
    await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 5, keyStage: "ks2" } });
    token = await createTestSession(user.id);

    const subject = await prisma.subject.create({ data: { slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: { providerSlug: "maths:5", subjectId: subject.id, yearGroup: 5, keyStage: "ks2", title: "Maths — Year 5" },
    });
    const unit = await prisma.unit.create({
      data: { providerSlug: "fractions", programmeId: programme.id, title: "Fractions", order: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: { providerSlug: "halves", unitId: unit.id, title: "Halves", order: 1 },
    });
    const video = await prisma.lessonResource.create({
      data: { lessonId: lesson.id, type: "VIDEO", label: "Video", providerUrl: ENDPOINT },
    });
    resourceId = video.id;
    const placeholder = await prisma.lessonResource.create({
      data: { lessonId: lesson.id, type: "WORKSHEET", label: "Worksheet", providerUrl: "fixture://worksheet/halves" },
    });
    placeholderId = placeholder.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OAK_API_KEY;
  });

  function request(id: string, headers: Record<string, string> = {}) {
    return GET(new Request(`http://localhost/api/curriculum/resources/${id}`, { headers }), {
      params: Promise.resolve({ resourceId: id }),
    });
  }
  const asStudent = (extra: Record<string, string> = {}) => ({ cookie: `${SESSION_COOKIE}=${token}`, ...extra });

  it("sends the player straight to a signed link that is fit for it", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ url: SIGNED }))
      .mockResolvedValueOnce(new Response("x", { status: 206, headers: { "content-type": "video/mp4" } }));

    const res = await request(resourceId, asStudent({ range: "bytes=0-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(SIGNED);
    expect(res.headers.get("cache-control")).toContain("no-store");

    // The row now says what the file is, and the second request costs no provider call.
    const row = await prisma.lessonResource.findUniqueOrThrow({ where: { id: resourceId } });
    expect(row.mimeType).toBe("video/mp4");
    const again = await request(resourceId, asStudent());
    expect(again.status).toBe(302);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("proxies and relabels a link whose host calls the video something else, keeping the range", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ url: SIGNED }))
      .mockResolvedValueOnce(new Response("x", { status: 206, headers: { "content-type": "application/octet-stream" } }))
      .mockResolvedValueOnce(
        new Response("abcd", {
          status: 206,
          headers: {
            "content-type": "application/octet-stream",
            "content-range": "bytes 0-3/100",
            "content-length": "4",
          },
        }),
      );

    const res = await request(resourceId, asStudent({ range: "bytes=0-3" }));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-range")).toBe("bytes 0-3/100");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(await res.text()).toBe("abcd");

    const [, init] = fetchMock.mock.calls[2]!;
    expect((init?.headers as Record<string, string>).Range).toBe("bytes=0-3");
  });

  it("passes the file through when the endpoint streams it itself", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("mp4bytes", { status: 200, headers: { "content-type": "video/mp4", "content-length": "8" } }),
    );

    const res = await request(resourceId, asStudent());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(await res.text()).toBe("mp4bytes");
  });

  it("never serves a file to somebody who is not logged in", async () => {
    const res = await request(resourceId);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says a placeholder is a placeholder instead of trying to fetch it", async () => {
    const res = await request(placeholderId, asStudent());
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toContain("placeholder");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a provider that refuses the key in words a parent can act on", async () => {
    fetchMock.mockResolvedValueOnce(new Response("API token not provided or invalid", { status: 401 }));
    const res = await request(resourceId, asStudent());
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toContain("OAK_API_KEY");
  });
});
