/**
 * Can we show a provider's page inside our own?
 *
 * Guessing is not good enough here: an iframe a site refuses to be shown in renders as a blank
 * box, and a blank box where a lesson should be is worse than a link. Browsers give no reliable
 * signal either — a blocked frame usually still fires `load` — so the client cannot detect it.
 *
 * The server can. It asks the page for its headers and reads the two that decide this:
 * `X-Frame-Options` and CSP `frame-ancestors`. The answer is a property of the site, not the
 * page, so it is cached per host: one request tells us about every lesson.
 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { embeddable: boolean; checkedAt: number }>();

/** Reads the framing headers. Exported for testing against a controlled response. */
export function headersAllowFraming(headers: Headers, selfOrigin: string): boolean {
  const xfo = headers.get("x-frame-options")?.trim().toLowerCase();
  // DENY and SAMEORIGIN both rule us out; the obsolete ALLOW-FROM is a single origin.
  if (xfo === "deny" || xfo === "sameorigin") return false;
  if (xfo?.startsWith("allow-from")) return xfo.includes(selfOrigin.toLowerCase());

  const csp = headers.get("content-security-policy");
  if (csp) {
    const directive = csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.toLowerCase().startsWith("frame-ancestors"));

    if (directive) {
      const sources = directive.split(/\s+/).slice(1).map((v) => v.toLowerCase());
      if (sources.includes("'none'")) return false;
      if (sources.includes("*")) return true;
      // 'self' means the provider only, which is not us.
      return sources.some((source) => source !== "'self'" && selfOrigin.toLowerCase().includes(source.replace(/^https?:\/\//, "")));
    }
  }

  // No opinion expressed means framing is allowed.
  return true;
}

/**
 * Asks whether `url` may be framed by `selfOrigin`.
 *
 * Never throws and never blocks for long: a provider that is slow or unreachable is treated as
 * not embeddable, which falls back to a plain link — the thing that always works.
 */
export async function canEmbed(url: string, selfOrigin: string): Promise<boolean> {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return false;
  }

  const hit = cache.get(host);
  if (hit && Date.now() - hit.checkedAt < CACHE_TTL_MS) return hit.embeddable;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Oakman Academy (home education)" },
    });
    clearTimeout(timer);

    const embeddable = res.ok && headersAllowFraming(res.headers, selfOrigin);
    cache.set(host, { embeddable, checkedAt: Date.now() });
    return embeddable;
  } catch {
    cache.set(host, { embeddable: false, checkedAt: Date.now() });
    return false;
  }
}
