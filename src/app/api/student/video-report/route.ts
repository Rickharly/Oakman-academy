/**
 * POST /api/student/video-report — a child's own browser reporting what it actually received
 * when a lesson's video refused to play.
 *
 * Every fix to the video so far was decided by reasoning from a server that has different
 * network access and a different browser than the Chromebook a child is actually holding, and
 * every one of those diagnoses was wrong. This is the browser's own evidence instead: the same
 * request the player made, and what came back, stored so a parent can read it without a
 * terminal. Student-authenticated and scoped to the reporting child — nobody else's evidence.
 */
import { z } from "zod";
import { ApiError, jsonError, requireStudentApi } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** A report is text, a few numbers and a handful of headers — nothing here needs to be big. */
const MAX_BODY_BYTES = 8_000;

const probeSchema = z.object({
  status: z.number().int().min(0).max(999).nullable(),
  contentType: z.string().max(200).nullable(),
  contentLength: z.string().max(50).nullable(),
  contentRange: z.string().max(100).nullable(),
  acceptRanges: z.string().max(50).nullable(),
  redirected: z.boolean().nullable(),
  responseType: z.string().max(30).nullable(),
  /** Meant to be a bare host — re-checked in `sanitizeHost` before it is ever stored. */
  urlHost: z.string().max(300).nullable(),
  bodySnippet: z.string().max(200).nullable(),
  networkErrorName: z.string().max(100).nullable(),
  networkErrorMessage: z.string().max(500).nullable(),
});

const bodySchema = z.object({
  lessonId: z.string().min(1).max(100),
  resourceId: z.string().min(1).max(100),
  /** The same sentence the player itself shows for the video slot. */
  videoState: z.string().max(300),
  userAgent: z.string().max(500),
  elementErrorCode: z.number().int().min(0).max(10).nullable(),
  elementErrorMessage: z.string().max(500).nullable(),
  probe: probeSchema,
});

/**
 * A host, and only ever a host.
 *
 * The client is only supposed to send `new URL(res.url).host`, but this is evidence arriving
 * from the open web, so it is trusted no further here than that either: a full URL is cut down
 * to its host, and anything not URL-shaped is cut at the first `?` or `/` — so a signed query
 * string, which is a credential, can never end up persisted regardless of what actually arrives.
 */
function sanitizeHost(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).host || null;
  } catch {
    const cut = raw.split("?")[0]!.split("/")[0]!.trim();
    return cut ? cut.slice(0, 300) : null;
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireStudentApi(req);

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) throw new ApiError(413, "That report is too large.");

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Malformed report.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new ApiError(400, "Malformed report.");
    const body = parsed.data;

    await prisma.activityLog.create({
      data: {
        studentId: user.studentProfile.id,
        kind: "video_report",
        data: {
          lessonId: body.lessonId,
          resourceId: body.resourceId,
          videoState: body.videoState,
          userAgent: body.userAgent,
          elementErrorCode: body.elementErrorCode,
          elementErrorMessage: body.elementErrorMessage,
          probe: {
            status: body.probe.status,
            contentType: body.probe.contentType,
            contentLength: body.probe.contentLength,
            contentRange: body.probe.contentRange,
            acceptRanges: body.probe.acceptRanges,
            redirected: body.probe.redirected,
            responseType: body.probe.responseType,
            urlHost: sanitizeHost(body.probe.urlHost),
            bodySnippet: body.probe.bodySnippet,
            networkErrorName: body.probe.networkErrorName,
            networkErrorMessage: body.probe.networkErrorMessage,
          },
        },
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
