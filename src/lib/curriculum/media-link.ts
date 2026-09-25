/**
 * Where a lesson's file actually is, for a browser that wants to play it.
 *
 * The address stored against a resource is the provider's asset *endpoint*. Called with the API
 * key it answers with JSON holding a short-lived signed link to the real file on a CDN. Two
 * things have gone wrong here before: the route once pulled the whole file down from the CDN
 * into the container's disk before answering the player's first request (stalls, then the
 * container running out of memory), and after that was fixed by streaming, the route instead
 * 302-redirected the browser straight to the CDN — which children's managed Chromebooks would
 * not reliably play, either because Chrome treats a cross-origin redirect from a `<video>`
 * differently than Safari does, or because the school network blocks the CDN host outright.
 *
 * So the route (`src/app/api/curriculum/resources/[resourceId]/route.ts`) now streams the bytes
 * back through our own origin by default: it resolves the endpoint to this signed link, then
 * fetches the link itself and pipes the response body straight through, forwarding the
 * player's Range header and never buffering. The redirect this module makes possible is still
 * there, but only behind `MEDIA_REDIRECT_TO_CDN=true` — see the route for why it defaults off.
 *
 * The link is checked once before it is used (does it answer, what does it say the file is,
 * does it honour ranges), and remembered until shortly before it expires, so a lesson costs one
 * provider request however many times the player asks — not one per seek.
 */
import { ApiError } from "@/lib/auth/api";
import { describeFetchError, findUrl, resolveAssetUrl } from "./asset-fetch";

export type MediaLink = {
  /** The signed address of the file itself. */
  url: string;
  /** When the link stops working, in ms since the epoch. */
  expiresAt: number;
  /** What the file's host says the file is; null when it said nothing useful. */
  contentType: string | null;
  /** Whether the host honours Range requests — what a player needs to seek, and what Safari needs at all. */
  acceptsRanges: boolean;
};

export type ResolvedMedia =
  /** The file lives at a signed link a browser can be sent to. */
  | { kind: "link"; link: MediaLink }
  /** The endpoint handed the file over directly; this is it, already open. */
  | { kind: "stream"; response: Response };

/** When a signed link says nothing about its own expiry, assume this much. */
const DEFAULT_LINK_LIFETIME_MS = 20 * 60 * 1000;
/** Never trust a link past this, whatever it claims: a stale link is a failed lesson. */
const MAX_LINK_LIFETIME_MS = 6 * 60 * 60 * 1000;
/** Stop using a link this long before it expires, so a lesson does not die mid-video. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/** Links already resolved, by resource id. One process, one entry per lesson file. */
const linkCache = new Map<string, MediaLink>();

/** Test-only: forget every resolved link. */
export function resetMediaLinkCache(): void {
  linkCache.clear();
}

/**
 * Drops one resource's cached link, so the next call resolves a fresh one.
 *
 * A signed link can stop working before our own clock thinks it should — the provider can
 * revoke it early, or our guess at its lifetime (a scheme we do not recognise, or a claimed
 * expiry we chose not to trust) can be optimistic. The route calls this once, on a failed
 * fetch of the cached link, before it gives up and tells the player the lesson is broken.
 */
export function forgetMediaLink(resourceId: string): void {
  linkCache.delete(resourceId);
}

/** `20260914T073000Z` → ms since the epoch, or null if it is not that shape. */
function parseCompactUtc(value: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

/** The `exp` claim of a JWT, in ms, or null. Mux-style links carry their expiry this way. */
function jwtExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * When a signed link stops working, read from the link itself.
 *
 * Every signing scheme writes its expiry into the query string, each in its own way: Google
 * and Amazon as a date plus a lifetime in seconds, older schemes and CloudFront as a plain
 * unix time, Mux as a JWT. Unknown schemes get a short default rather than a guess.
 */
export function signedLinkExpiry(url: string, now = Date.now()): number {
  let claimed: number | null = null;
  try {
    const params = new URL(url).searchParams;
    const get = (name: string) => params.get(name) ?? params.get(name.toLowerCase());

    const goog = get("X-Goog-Expires");
    const googDate = get("X-Goog-Date");
    const amz = get("X-Amz-Expires");
    const amzDate = get("X-Amz-Date");
    const unix = get("Expires") ?? get("exp") ?? get("expires");
    const token = get("token");

    if (goog && googDate && parseCompactUtc(googDate) !== null) {
      claimed = parseCompactUtc(googDate)! + Number(goog) * 1000;
    } else if (amz && amzDate && parseCompactUtc(amzDate) !== null) {
      claimed = parseCompactUtc(amzDate)! + Number(amz) * 1000;
    } else if (unix && /^\d{9,13}$/.test(unix)) {
      claimed = unix.length > 11 ? Number(unix) : Number(unix) * 1000;
    } else if (token) {
      claimed = jwtExpiry(token);
    }
  } catch {
    claimed = null;
  }

  if (claimed === null || !Number.isFinite(claimed) || claimed <= now) return now + DEFAULT_LINK_LIFETIME_MS;
  return Math.min(claimed, now + MAX_LINK_LIFETIME_MS);
}

/** Whether a remembered link is still safe to hand out. */
export function linkIsFresh(link: MediaLink, now = Date.now()): boolean {
  return link.expiresAt - EXPIRY_MARGIN_MS > now;
}

/** Asks the provider's endpoint, with the key, and says what came back. */
async function callAssetEndpoint(endpoint: string, range: string | null): Promise<Response> {
  const apiKey = process.env.OAK_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  // Harmless to a JSON endpoint, essential when the endpoint streams the file itself.
  if (range) headers.Range = range;

  const res = await fetch(endpoint, { headers, cache: "no-store" }).catch((err: unknown) => {
    // Say which host could not be reached. "fetch failed" on its own is unactionable.
    throw new ApiError(502, `Could not reach ${new URL(endpoint).host}: ${describeFetchError(err)}`);
  });

  if (res.ok && res.body) return res;

  if (res.status === 400) {
    // Documented, and not a fault of ours: some assets are not the provider's to hand out.
    const detail = await res.text().catch(() => "");
    throw new ApiError(
      451,
      /copyright/i.test(detail)
        ? "The provider cannot share this file for copyright reasons."
        : "The provider will not serve this file.",
    );
  }
  const denied = res.status === 401 || res.status === 403;
  throw new ApiError(
    denied ? 502 : res.status,
    denied
      ? "The curriculum provider refused the request. Check OAK_API_KEY is set on the server."
      : `The provider returned ${res.status}.`,
  );
}

/**
 * One small request to the file's host, to learn what it will do for a player.
 *
 * Asks for the first byte only. A host that answers 206 honours ranges; one that answers 200
 * to that will hand a player the whole file from the start on every seek — and Safari will
 * not play from it at all. The content type is read here too, so the route can decide whether
 * the browser can be trusted with the host's answer or the file has to be relabelled.
 */
async function probeLink(url: string): Promise<Pick<MediaLink, "contentType" | "acceptsRanges">> {
  const res = await fetch(url, { headers: { Range: "bytes=0-0" }, cache: "no-store" }).catch((err: unknown) => {
    throw new ApiError(502, `Could not reach ${new URL(url).host}: ${describeFetchError(err)}`);
  });
  await res.body?.cancel().catch(() => undefined);
  if (!res.ok) throw new ApiError(502, `The file link returned ${res.status}.`);

  const rawType = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const useless = !rawType || rawType === "application/octet-stream" || rawType === "binary/octet-stream";
  return {
    contentType: useless ? null : rawType,
    acceptsRanges: res.status === 206 || (res.headers.get("accept-ranges") ?? "").toLowerCase() === "bytes",
  };
}

/**
 * Where the file for this resource is, following the signed-link indirection.
 *
 * `range` is passed through only for the case where the provider's endpoint streams the file
 * itself rather than pointing at it; the link case answers the player's ranges from the CDN.
 */
export async function resolveMedia(
  resource: { id: string; providerUrl: string | null },
  opts: { range?: string | null } = {},
): Promise<ResolvedMedia> {
  const remembered = linkCache.get(resource.id);
  if (remembered && linkIsFresh(remembered)) return { kind: "link", link: remembered };
  linkCache.delete(resource.id);

  if (!resource.providerUrl) throw new ApiError(404, "This resource has no downloadable file.");
  const endpoint = resolveAssetUrl(resource.providerUrl);
  const first = await callAssetEndpoint(endpoint, opts.range ?? null);

  // Not JSON: the endpoint is the file. Hand it over as it is.
  if (!(first.headers.get("content-type") ?? "").includes("application/json")) {
    return { kind: "stream", response: first };
  }

  const payload = await first.json().catch(() => null);
  const signed = findUrl(payload);
  if (!signed) throw new ApiError(502, "The provider did not return a link to this file.");

  const probe = await probeLink(signed);
  const link: MediaLink = { url: signed, expiresAt: signedLinkExpiry(signed), ...probe };
  linkCache.set(resource.id, link);
  return { kind: "link", link };
}
