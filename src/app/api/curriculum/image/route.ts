/**
 * GET /api/curriculum/image?question=<id>&option=<id> — a question's picture.
 *
 * Served through us rather than linked directly, for the same reason the videos are: the
 * provider's media may need the API key, which the browser must never hold, and a browser that
 * is quietly refused shows a blank box with no way to tell why.
 *
 * Deliberately not a general proxy. It will only fetch a URL that is already stored on one of
 * this lesson's questions — nothing a caller supplies is fetched, so this cannot be pointed at
 * anything else.
 */
import { ApiError, jsonError, requireUserApi } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { imageSchema, optionSchema } from "@/lib/questions/types";
import { resolveAssetUrl } from "@/lib/curriculum/asset-fetch";
import { z } from "zod";

export const dynamic = "force-dynamic";

const optionsSchema = z.object({ choices: z.array(optionSchema) }).partial();

export async function GET(req: Request) {
  try {
    await requireUserApi(req);

    const url = new URL(req.url);
    const questionId = url.searchParams.get("question");
    const optionId = url.searchParams.get("option");
    if (!questionId) throw new ApiError(400, "No question given.");

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { promptImage: true, options: true },
    });
    if (!question) throw new ApiError(404, "Question not found.");

    let source: string | null = null;
    if (optionId) {
      const options = optionsSchema.safeParse(question.options);
      const choice = options.success ? (options.data.choices ?? []).find((c) => c.id === optionId) : undefined;
      source = choice?.image?.url ?? null;
    } else {
      const image = imageSchema.safeParse(question.promptImage);
      source = image.success ? image.data.url : null;
    }
    if (!source) throw new ApiError(404, "That question has no picture.");

    // Oak's own asset endpoints hand back paths relative to the API, the same as any other
    // provider asset link — resolved the same way `fetchProviderAsset` resolves them, so a
    // stored picture reference isn't wrongly treated as missing just because it wasn't already
    // absolute. `resolveAssetUrl` itself throws a 404 for a scheme we don't resolve
    // (`fixture://` placeholder content), which is exactly "this question has no real picture".
    const resolved = resolveAssetUrl(source);

    // The key goes only to the provider's own host, and never to a third-party CDN that has no
    // use for it and might refuse the request because of it.
    const isProvider = /thenational\.academy$/i.test(new URL(resolved).hostname);
    const apiKey = process.env.OAK_API_KEY;
    const upstream = await fetch(resolved, {
      headers: isProvider && apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      cache: "no-store",
    }).catch(() => null);

    if (!upstream?.ok || !upstream.body) {
      throw new ApiError(502, `The picture could not be fetched (${upstream?.status ?? "no response"}).`);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/png",
        // Pictures do not change. Cache hard so a child scrolling back is instant and free.
        "cache-control": "private, max-age=86400",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
