import { requireUserApi, jsonError, ApiError } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

/**
 * Streams a curriculum resource — a lesson video, a worksheet PDF — through the server.
 *
 * Oak's asset URLs need the API key. The browser has no key, which is why linking straight to
 * them gave the child "API token not provided or invalid" instead of their worksheet. Proxying
 * keeps the key on the server, where it belongs: Oak's terms are explicit that it must not be
 * exposed in a publicly accessible service.
 *
 * Range requests are forwarded so a video can be scrubbed rather than only played from the
 * start, and every request requires a logged-in user so this is not an open proxy onto Oak.
 */
export const dynamic = "force-dynamic";

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

    const apiKey = process.env.OAK_API_KEY;
    const range = req.headers.get("range");
    const upstream = await fetch(url, {
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(range ? { Range: range } : {}),
      },
      // The provider's own cache headers are not ours to trust for a signed URL.
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      throw new ApiError(
        upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status,
        upstream.status === 401 || upstream.status === 403
          ? "The curriculum provider refused the request. Check OAK_API_KEY is set on the server."
          : `The provider returned ${upstream.status}.`,
      );
    }

    const headers = new Headers();
    const passthrough = ["content-type", "content-length", "content-range", "accept-ranges", "etag"];
    for (const name of passthrough) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has("content-type") && resource.mimeType) headers.set("content-type", resource.mimeType);
    // Private: this is a child's lesson material behind their login, not public content.
    headers.set("cache-control", "private, max-age=3600");
    headers.set("content-disposition", `inline; filename="${encodeURIComponent(resource.label)}"`);

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    return jsonError(err);
  }
}
