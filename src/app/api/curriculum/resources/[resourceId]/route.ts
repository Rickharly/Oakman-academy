import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { requireUserApi, jsonError, ApiError } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

/**
 * Serves a lesson's video or worksheet.
 *
 * Two things make this more than a redirect.
 *
 * **The key must stay on the server.** Oak's asset endpoints need the API key, which is why
 * linking the browser straight at them gave a child "API token not provided or invalid"
 * instead of their worksheet. Oak's terms also require the key not be exposed in a publicly
 * accessible service.
 *
 * **The file is fetched from Oak once, then cached.** A video player does not download a file
 * once — it sends a stream of Range requests as the child plays and scrubs. Passing each of
 * those upstream would spend a request from Oak's quota per seek, and a single lesson could
 * burn what a whole subject's import needs. So the first request pulls the file down, and
 * every request after that is served from local disk with proper Range support.
 *
 * The cache is deliberately disposable — a container restart empties it and the next request
 * simply fetches again.
 */
export const dynamic = "force-dynamic";

const CACHE_DIR = process.env.MEDIA_CACHE_DIR ?? path.join(os.tmpdir(), "oakman-media");
/** Anything larger than this is streamed through rather than cached, to protect the disk. */
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
/**
 * The whole cache stays under this.
 *
 * A container's disk is small and shared with everything else running in it. An unbounded
 * cache of lesson videos will eventually fill it, and a full disk does not degrade a service —
 * it kills it. Better to re-fetch a video occasionally than to take the school offline.
 */
const MAX_CACHE_TOTAL_BYTES = Number(process.env.MEDIA_CACHE_MAX_BYTES ?? 256 * 1024 * 1024);

/**
 * What this file actually is, for the browser.
 *
 * A `<video>` element handed `application/octet-stream` renders its controls, shows 0:00, and
 * never plays — which looks exactly like "there is no video for this lesson" and is not. Oak
 * does not always send a useful content-type, and we stored whatever it sent, so the resource
 * type is the thing to trust: a VIDEO row is a video whatever the header said.
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

function contentTypeFor(resource: { type: string; mimeType: string | null }, upstream: string | null): string {
  const fallback = TYPE_DEFAULTS[resource.type];
  for (const candidate of [upstream, resource.mimeType]) {
    if (!candidate) continue;
    const clean = candidate.split(";")[0]!.trim().toLowerCase();
    // Generic types tell the browser nothing; prefer what we know the row to be.
    if (clean && clean !== "application/octet-stream" && clean !== "binary/octet-stream") return candidate;
  }
  return fallback ?? "application/octet-stream";
}

/** Deletes the least recently used files until the cache fits in its budget again. */
async function evictTo(budget: number): Promise<void> {
  try {
    const names = await fsp.readdir(CACHE_DIR);
    const files = await Promise.all(
      names.map(async (name) => {
        const full = path.join(CACHE_DIR, name);
        const stat = await fsp.stat(full).catch(() => null);
        return stat?.isFile() ? { full, size: stat.size, atime: stat.atimeMs } : null;
      }),
    );

    const present = files.filter((f): f is { full: string; size: number; atime: number } => f !== null);
    let total = present.reduce((n, f) => n + f.size, 0);
    if (total <= budget) return;

    present.sort((a, b) => a.atime - b.atime); // oldest touched goes first
    for (const file of present) {
      if (total <= budget) break;
      await fsp.rm(file.full, { force: true }).catch(() => undefined);
      total -= file.size;
    }
  } catch {
    // A cache we cannot tidy is not a reason to fail the request.
  }
}

function cachePathFor(resourceId: string, url: string): string {
  const digest = createHash("sha256").update(`${resourceId}:${url}`).digest("hex").slice(0, 32);
  return path.join(CACHE_DIR, digest);
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

export async function GET(req: Request, ctx: { params: Promise<{ resourceId: string }> }) {
  try {
    await requireUserApi(req);
    const { resourceId } = await ctx.params;

    const resource = await prisma.lessonResource.findUnique({ where: { id: resourceId } });
    if (!resource) throw new ApiError(404, "Resource not found");

    const url = resource.providerUrl;
    if (!url || !/^https:\/\//i.test(url)) {
      throw new ApiError(404, "This resource has no downloadable file.");
    }

    const contentType = contentTypeFor(resource, null);
    const file = cachePathFor(resourceId, url);

    // Already downloaded: never touch Oak again, however much the child scrubs.
    const cached = await fsp.stat(file).catch(() => null);
    if (cached?.isFile() && cached.size > 0) {
      return serveFromDisk(file, cached.size, contentType, req, resource.label);
    }

    const apiKey = process.env.OAK_API_KEY;
    const upstream = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      const denied = upstream.status === 401 || upstream.status === 403;
      throw new ApiError(
        denied ? 502 : upstream.status,
        denied
          ? "The curriculum provider refused the request. Check OAK_API_KEY is set on the server."
          : `The provider returned ${upstream.status}.`,
      );
    }

    const upstreamType = upstream.headers.get("content-type") ?? contentType;
    const declared = Number(upstream.headers.get("content-length") ?? "0");

    const bytesExpected = declared > 0 ? declared : MAX_CACHE_BYTES;

    // Remember what it turned out to be, so the next request knows before fetching.
    if (!resource.mimeType && upstreamType && !upstreamType.startsWith("application/octet-stream")) {
      await prisma.lessonResource
        .update({ where: { id: resource.id }, data: { mimeType: upstreamType } })
        .catch(() => undefined);
    }

    const served = contentTypeFor(resource, upstreamType);

    // Play now; cache in the background.
    //
    // The old code downloaded the whole file before answering — and did it into memory. For a
    // fifty-megabyte lesson video that meant a child stared at a player showing 0:00 until the
    // request timed out, which is indistinguishable from "this lesson has no video", and on a
    // small container it took the server down with it.
    //
    // The stream is split: one half goes to the browser immediately, the other is written to
    // disk for the next request. Backpressure is bounded by the slower of the two, and if the
    // disk copy fails the child still gets their video.
    const [toClient, toDisk] = upstream.body.tee();

    if (declared <= MAX_CACHE_BYTES) {
      void (async () => {
        try {
          await fsp.mkdir(CACHE_DIR, { recursive: true });
          // Make room before writing, not after: the disk has to hold this file either way.
          await evictTo(Math.max(0, MAX_CACHE_TOTAL_BYTES - bytesExpected));
          const temp = `${file}.${process.pid}.${Date.now()}.part`;
          await pipeline(Readable.fromWeb(toDisk as WebReadableStream), fs.createWriteStream(temp));
          await fsp.rename(temp, file).catch(async () => {
            await fsp.rm(temp, { force: true });
          });
        } catch {
          // A cache that will not write is a slower lesson, not a broken one.
        }
      })();
    } else {
      void toDisk.cancel().catch(() => undefined);
    }

    return new Response(toClient, {
      status: 200,
      headers: {
        "content-type": served,
        ...(declared > 0 ? { "content-length": String(declared) } : {}),
        "cache-control": "private, max-age=3600",
        "content-disposition": `inline; filename="${encodeURIComponent(resource.label)}"`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
