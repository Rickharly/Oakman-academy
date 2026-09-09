/**
 * Fetching a lesson's actual file from the provider.
 *
 * The URL stored against a resource is not the file. It is the provider's asset *endpoint*,
 * and that endpoint answers with JSON holding a short-lived signed link to the real file. We
 * were handing that JSON straight to the browser: a `<video>` given a few hundred bytes of
 * JSON renders its controls, sits at 0:00 and never plays, which is indistinguishable from a
 * lesson having no video. The PDF reader got the same JSON, which is why worksheets could not
 * be read either.
 *
 * Signed links expire, so the link is followed on every fetch and never stored — only the file
 * it points at is cached.
 */
import { ApiError } from "@/lib/auth/api";
import { DEFAULT_OAK_BASE_URL } from "@/lib/oak/client";

/**
 * The absolute URL for a stored asset link.
 *
 * The provider's asset listing gives "the download endpoint for the asset", and that is not
 * promised to be absolute. A relative one handed straight to `fetch` fails with nothing but
 * "TypeError: fetch failed" — no status, no host, no clue — which is exactly what a lesson's
 * video was doing. Resolving against the API's own base turns that back into a real request.
 */
export function resolveAssetUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // A scheme we do not speak — `fixture://` from the bundled placeholders — is not a path to be
  // resolved. Saying so beats "unknown scheme" from somewhere inside a stream.
  if (trimmed.includes("://")) {
    throw new ApiError(404, `"${trimmed}" is not a real file — this is placeholder content, not a lesson resource.`);
  }
  const base = process.env.OAK_BASE_URL || DEFAULT_OAK_BASE_URL;
  return new URL(trimmed.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`).toString();
}

/** Node hides the real reason — ECONNREFUSED, DNS, TLS — in `cause`. Without it, every network
 * failure reads as the same useless "fetch failed". */
export function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  const causeText =
    cause instanceof Error
      ? ` (${cause.name}: ${cause.message}${(cause as { code?: string }).code ? ` [${(cause as { code?: string }).code}]` : ""})`
      : cause
        ? ` (${String(cause)})`
        : "";
  return `${err.name}: ${err.message}${causeText}`;
}

/**
 * The first https URL anywhere in the payload.
 *
 * The response shape is not documented, so it is hunted for rather than assumed: likely names
 * first, then everything else.
 */
export function findUrl(value: unknown, depth = 0): string | null {
  if (depth > 6) return null;
  if (typeof value === "string") return /^https:\/\//i.test(value) ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "signedUrl", "downloadUrl", "href", "location", "src"]) {
      const found = findUrl(record[key], depth + 1);
      if (found) return found;
    }
    for (const item of Object.values(record)) {
      const found = findUrl(item, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Fetches a provider asset, following the signed-link indirection.
 *
 * The API key stays on the server: it is sent to the provider's endpoint and never to the
 * browser, and never to the signed link either — signed links carry their own authorisation
 * and adding ours can be refused.
 */
export async function fetchProviderAsset(url: string): Promise<Response> {
  const apiKey = process.env.OAK_API_KEY;
  const endpoint = resolveAssetUrl(url);
  const first = await fetch(endpoint, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    cache: "no-store",
  }).catch((err: unknown) => {
    // Say which host could not be reached. "fetch failed" on its own is unactionable.
    throw new ApiError(502, `Could not reach ${new URL(endpoint).host}: ${describeFetchError(err)}`);
  });

  if (!first.ok || !first.body) {
    if (first.status === 400) {
      // Documented, and not a fault of ours: some assets are not the provider's to hand out.
      const detail = await first.text().catch(() => "");
      throw new ApiError(
        451,
        /copyright/i.test(detail)
          ? "The provider cannot share this file for copyright reasons."
          : "The provider will not serve this file.",
      );
    }
    const denied = first.status === 401 || first.status === 403;
    throw new ApiError(
      denied ? 502 : first.status,
      denied
        ? "The curriculum provider refused the request. Check OAK_API_KEY is set on the server."
        : `The provider returned ${first.status}.`,
    );
  }

  if (!(first.headers.get("content-type") ?? "").includes("application/json")) return first;

  const payload = await first.json().catch(() => null);
  const signed = findUrl(payload);
  if (!signed) throw new ApiError(502, "The provider did not return a link to this file.");

  const second = await fetch(signed, { cache: "no-store" }).catch((err: unknown) => {
    throw new ApiError(502, `Could not reach ${new URL(signed).host}: ${describeFetchError(err)}`);
  });
  if (!second.ok || !second.body) throw new ApiError(502, `The file link returned ${second.status}.`);
  return second;
}
