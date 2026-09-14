import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { requireUserApi, jsonError, ApiError } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { resolveMedia, type MediaLink } from "@/lib/curriculum/media-link";

/**
 * Serves a lesson's video or worksheet.
 *
 * **The key stays on the server.** Oak's asset endpoints need the API key, which is why linking
 * the browser straight at them gave a child "API token not provided or invalid" instead of
 * their worksheet, and Oak's terms require the key never be exposed. So the browser asks us.
 *
 * **But the bytes do not come through us.** The endpoint answers with a signed link to the file
 * on a CDN, and the browser is sent there. This route used to download the whole file into the
 * container before answering the player's first request, and if that failed it streamed a
 * plain 200 with no range support — which Safari on an iPad will not play at all. A CDN
 * already answers ranges, quickly, with the right type, without a hundred megabytes crossing a
 * small container's disk. The one case we still proxy is a link that turns out unfit for a
 * player (a wrong content type, no range support), where we relabel and pass ranges through.
 *
 * A signed link is resolved once and remembered until shortly before it expires, so a lesson
 * costs one provider request however many times the player asks — not one per seek.
 */
export const dynamic = "force-dynamic";

/**
 * What this file actually is, for the browser.
 *
 * A `<video>` element handed `application/octet-stream` renders its controls, shows 0:00, and
 * never plays — which looks exactly like "there is no video for this lesson" and is not. The
 * host does not always say something useful, so the resource type is the thing to trust: a
 * VIDEO row is a video whatever the header said.
 */
const TYPE_DEFAULTS: Record<string, string> = {
  VIDEO: "video/mp4",
  WORKSHEET: "application/pdf",
  WORKSHEET_ANSWERS: "application/pdf",
  STARTER_QUIZ: "application/pdf",
  STARTER_QUIZ_ANSWERS: "application/pdf",
  EXIT_QUIZ: "application/pdf",
  EXIT_QUIZ_ANSWERS: "application/pdf",
};

function cleanType(candidate: string | null | undefined): string | null {
  const clean = candidate?.split(";")[0]?.trim().toLowerCase();
  if (!clean) return null;
  // Generic types tell the browser nothing.
  if (clean === "application/octet-stream" || clean === "binary/octet-stream") return null;
  return clean;
}

function contentTypeFor(resource: { type: string; mimeType: string | null }, upstream: string | null): string {
  const fallback = TYPE_DEFAULTS[resource.type];
  for (const candidate of [upstream, resource.mimeType]) {
    const clean = cleanType(candidate);
    if (!clean) continue;
    // A type that contradicts the row is worse than none — rows were stamped
    // "application/json" back when the signed-link response was mistaken for the file, and a
    // video labelled as JSON is a video that will not play.
    if (fallback && clean.split("/")[0] !== fallback.split("/")[0]) continue;
    return clean;
  }
  return fallback ?? "application/octet-stream";
}

/**
 * Whether the browser can be sent to the link as it is.
 *
 * It can when the host says the file is what the row says it is and honours ranges. A host
 * that calls a video `application/octet-stream` would leave Safari showing 0:00 forever; one
 * that ignores ranges would leave it unable to seek. Both are proxied and corrected instead.
 */
function browserCanUseDirectly(resource: { type: string }, link: MediaLink): boolean {
  if (!link.acceptsRanges) return false;
  const wanted = TYPE_DEFAULTS[resource.type];
  if (!wanted) return Boolean(link.contentType);
  return link.contentType?.split("/")[0] === wanted.split("/")[0];
}

/**
 * Whether a stored file is actually the provider's JSON rather than the asset.
 *
 * Reads the first byte only. A video, a PDF and a slide deck all start with something that is
 * not a brace; the provider's asset response always does.
 */
async function looksLikeJson(file: string): Promise<boolean> {
  const handle = await fsp.open(file, "r").catch(() => null);
  if (!handle) return false;
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(1), 0, 1, 0);
    if (bytesRead < 1) return false;
    const first = String.fromCharCode(buffer[0]!);
    return first === "{" || first === "[";
  } catch {
    return false;
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/** Parses "bytes=start-end" against a known size. Returns null when it is absent or unusable. */
function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  // "bytes=-500" means the last 500 bytes.
  const start = rawStart === "" ? Math.max(0, size - Number(rawEnd)) : Number(rawStart);
  const end = rawStart === "" ? size - 1 : rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
}

function serveFromDisk(file: string, size: number, contentType: string, req: Request, filename: string) {
  const range = parseRange(req.headers.get("range"), size);
  const headers = new Headers({
    "content-type": contentType,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=86400",
    "content-disposition": `inline; filename="${encodeURIComponent(filename)}"`,
  });

  if (!range) {
    headers.set("content-length", String(size));
    const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
    return new Response(stream, { status: 200, headers });
  }

  headers.set("content-length", String(range.end - range.start + 1));
  headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
  const stream = Readable.toWeb(
    fs.createReadStream(file, { start: range.start, end: range.end }),
  ) as ReadableStream;
  return new Response(stream, { status: 206, headers });
}

/**
 * Passes an upstream answer through to the browser, relabelled.
 *
 * The status and the range headers are the host's: a 206 with its content-range is exactly
 * what the player asked for and must not be flattened into a 200. Only the content type is
 * ours, because that is the one thing the host gets wrong.
 */
function passThrough(upstream: Response, contentType: string, filename: string): Response {
  if (!upstream.body) throw new ApiError(502, "The provider returned an empty file.");
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": "private, max-age=3600",
    "content-disposition": `inline; filename="${encodeURIComponent(filename)}"`,
  });
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (upstream.status === 206 && !headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
}

export async function GET(req: Request, ctx: { params: Promise<{ resourceId: string }> }) {
  try {
    await requireUserApi(req);
    const { resourceId } = await ctx.params;

    const resource = await prisma.lessonResource.findUnique({ where: { id: resourceId } });
    if (!resource) throw new ApiError(404, "Resource not found");

    /**
     * A copy downloaded at sync time, if there still is one.
     *
     * `storedPath` is a path on this machine's disk. It belongs to whichever container
     * downloaded it and does not survive a deploy, so it is used only when it is really there
     * — and really the file, not the provider's JSON saved under the file's name.
     */
    if (resource.storedPath) {
      const local = await fsp.stat(resource.storedPath).catch(() => null);
      if (local?.isFile() && local.size > 0 && !(await looksLikeJson(resource.storedPath))) {
        return serveFromDisk(resource.storedPath, local.size, contentTypeFor(resource, null), req, resource.label);
      }
    }

    const range = req.headers.get("range");
    const resolved = await resolveMedia(resource, { range });

    // The endpoint handed over the file itself. Pass it through with its ranges intact.
    if (resolved.kind === "stream") {
      const upstreamType = resolved.response.headers.get("content-type");
      return passThrough(resolved.response, contentTypeFor(resource, upstreamType), resource.label);
    }

    const { link } = resolved;

    // Remember what it turned out to be, so the row says what the file is.
    if (!resource.mimeType && link.contentType) {
      await prisma.lessonResource
        .update({ where: { id: resource.id }, data: { mimeType: link.contentType } })
        .catch(() => undefined);
    }

    /**
     * Send the browser to the file.
     *
     * A media element follows a redirect like any other fetch, and the CDN answers its ranges
     * directly. The link is signed and short-lived, so it must not be cached by anything on
     * the way — the next request comes back here and gets a fresh one when this has expired.
     */
    if (browserCanUseDirectly(resource, link)) {
      return new Response(null, {
        status: 302,
        headers: { location: link.url, "cache-control": "private, no-store" },
      });
    }

    // A link a player cannot use as it is: fetch the range the player asked for and relabel.
    const upstream = await fetch(link.url, {
      headers: range ? { Range: range } : {},
      cache: "no-store",
    }).catch(() => {
      throw new ApiError(502, `Could not reach ${new URL(link.url).host}.`);
    });
    if (!upstream.ok) throw new ApiError(502, `The file link returned ${upstream.status}.`);
    return passThrough(upstream, contentTypeFor(resource, upstream.headers.get("content-type")), resource.label);
  } catch (err) {
    return jsonError(err);
  }
}
