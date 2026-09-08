/**
 * Thin typed client over the Oak National Academy Open API.
 *
 * - `createOakClient` builds an `openapi-fetch` client typed against `./openapi.d.ts` (`paths`),
 *   with the bearer auth header, a ≤8 req/s throttle, and retry-with-backoff on 429/5xx
 *   (honouring `Retry-After`, up to 3 retries) baked into the underlying `fetch`.
 * - `oakGet` is the single call-site helper: it forwards to `client.GET` and throws a typed
 *   `OakApiError` for any non-2xx response (including network-level failures surfaced by
 *   openapi-fetch as an `error`).
 */
import createClient from "openapi-fetch";
import type { ClientPathsWithMethod, MaybeOptionalInit, MethodResponse } from "openapi-fetch";
import type { paths } from "./openapi";

export const DEFAULT_OAK_BASE_URL = "https://open-api.thenational.academy/api/v0/";

/**
 * A courtesy pace, not the limit. Oak's limit is a windowed quota (see `OakRateLimit`), so this
 * only stops us opening hundreds of sockets at once; it is not what keeps us inside the budget.
 */
const MAX_REQUESTS_PER_SECOND = 8;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429]);
/**
 * The longest we will sit and wait for a quota window to reset before giving up on this run.
 *
 * A deploy must not hang for an hour waiting for a quota. The sync is idempotent and resumable,
 * so stopping and finishing on the next run is strictly better than blocking the boot.
 */
const MAX_QUOTA_WAIT_MS = 60_000;
/** Below this many remaining requests we stop rather than start work we cannot finish. */
export const QUOTA_HEADROOM = 25;

export interface OakClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Override the underlying fetch (tests only); defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
}

/**
 * What Oak told us about our quota on the last response.
 *
 * Oak does not limit by requests per second — it grants a fixed number of requests per window
 * and tells you how many are left on every response. That distinction matters: throttling to
 * some rate does not help at all, because the budget is the budget however slowly you spend it.
 */
export type OakRateLimit = {
  limit: number;
  remaining: number;
  /** Milliseconds since the epoch when the window resets. */
  reset: number;
};

function parseRateLimit(response: Response): OakRateLimit | null {
  const limit = Number(response.headers.get("x-ratelimit-limit"));
  const remaining = Number(response.headers.get("x-ratelimit-remaining"));
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(reset)) return null;
  return { limit, remaining, reset };
}

/**
 * Thrown when the quota is gone.
 *
 * Separate from `OakApiError` because the response is different in kind: there is nothing wrong
 * with the request, and no amount of retrying inside this run will help. The caller should stop,
 * keep what it has, and come back after `reset`.
 */
export class OakRateLimitError extends Error {
  readonly path: string;
  readonly resetAt: Date | null;

  constructor(path: string, resetAt: Date | null) {
    const when = resetAt ? `Quota resets at ${formatLocalTime(resetAt)}.` : "Try again later.";
    super(`Oak API quota exhausted on ${path}. ${when}`);
    this.name = "OakRateLimitError";
    this.path = path;
    this.resetAt = resetAt;
  }
}

/** A wall-clock time in the family's own timezone — a reset time in UTC helps nobody. */
function formatLocalTime(at: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: process.env.SCHOOL_TIMEZONE || "Asia/Yerevan",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(at);
  } catch {
    return `${at.toISOString().slice(11, 16)} UTC`;
  }
}

/** Typed error thrown by `oakGet` for any non-2xx Oak response. */
export class OakApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly code?: string;
  readonly body?: unknown;

  constructor(status: number, path: string, message: string, opts?: { code?: string; body?: unknown }) {
    super(`Oak API ${status} on ${path}: ${message}`);
    this.name = "OakApiError";
    this.status = status;
    this.path = path;
    this.code = opts?.code;
    this.body = opts?.body;
  }
}

export type OakClient = ReturnType<typeof createClient<paths>>;

/** Rolling-window token limiter: at most `maxPerWindow` request starts per `windowMs`. */
class Throttle {
  private readonly windowMs = 1000;
  private readonly maxPerWindow: number;
  private starts: number[] = [];

  constructor(maxPerWindow: number) {
    this.maxPerWindow = maxPerWindow;
  }

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.starts = this.starts.filter((t) => now - t < this.windowMs);
      if (this.starts.length < this.maxPerWindow) {
        this.starts.push(now);
        return;
      }
      const oldest = this.starts[0]!;
      await sleep(this.windowMs - (now - oldest) + 5);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function retryDelayMs(response: Response, attempt: number, state: OakRateLimit | null): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateMs = Date.parse(retryAfter);
    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  // With no Retry-After, the reset timestamp is the only honest answer for a 429.
  if (response.status === 429 && state) return Math.max(0, state.reset - Date.now());
  // exponential backoff: 300ms, 600ms, 1200ms
  return 300 * 2 ** (attempt - 1);
}

/**
 * Wraps a fetch with the pacing and retry policy.
 *
 * A 429 is retried only when the wait is short enough to be worth sitting through. When the
 * window is minutes or hours away the response is returned as-is so the caller can stop
 * cleanly, rather than burning three more requests against a quota that is already gone.
 */
function throttledRetryFetch(
  baseFetch: typeof fetch,
  throttle: Throttle,
  onRateLimit: (state: OakRateLimit) => void,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let attempt = 0;
    for (;;) {
      await throttle.acquire();
      const response = await baseFetch(input, init);

      const state = parseRateLimit(response);
      if (state) onRateLimit(state);

      const retryable = RETRYABLE_STATUSES.has(response.status) || response.status >= 500;
      if (!retryable || attempt >= MAX_RETRIES) return response;

      // A 429 means the budget is spent. Retrying does not wait for more budget, it spends
      // what little is left — three retries per call is how a quota goes from low to zero.
      // Only a Retry-After we can actually honour justifies trying again.
      if (response.status === 429 && !response.headers.get("retry-after")) return response;

      const wait = retryDelayMs(response, attempt + 1, state);
      // Waiting out a whole quota window would hang a deploy; let the caller stop instead.
      if (wait > MAX_QUOTA_WAIT_MS) return response;

      attempt += 1;
      await sleep(wait);
    }
  }) as typeof fetch;
}

/** Creates a typed Oak Open API client with auth, throttling and retry wired in. */
/**
 * The quota Oak reported on the most recent response from a given client.
 *
 * Kept beside the client rather than inside it because `openapi-fetch` has nowhere to hang it,
 * and a `WeakMap` means a discarded client takes its state with it.
 */
const rateLimitState = new WeakMap<OakClient, OakRateLimit>();

/** What Oak last told us about the quota, or null if it has not said yet. */
export function lastKnownRateLimit(client: OakClient): OakRateLimit | null {
  return rateLimitState.get(client) ?? null;
}

export function createOakClient(options: OakClientOptions): OakClient {
  const throttle = new Throttle(MAX_REQUESTS_PER_SECOND);
  const baseFetch = options.fetch ?? globalThis.fetch;

  // The fetch wrapper needs to record the quota against the client it belongs to, but that
  // client does not exist until createClient returns — hence the holder.
  const self: { client?: OakClient } = {};
  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? DEFAULT_OAK_BASE_URL,
    headers: { Authorization: `Bearer ${options.apiKey}` },
    fetch: throttledRetryFetch(baseFetch, throttle, (state) => {
      if (self.client) rateLimitState.set(self.client, state);
    }),
  });
  self.client = client;
  return client;
}

/**
 * Asks Oak how much quota is left. This endpoint does not itself count against the quota, so it
 * is safe to call before deciding whether to start a long import.
 */
export async function getRateLimit(client: OakClient): Promise<OakRateLimit | null> {
  try {
    const data = await oakGet(client, "/rate-limit");
    return data as OakRateLimit;
  } catch {
    // Not knowing the quota is not a reason to refuse to work.
    return null;
  }
}

interface OakErrorBody {
  message?: string;
  code?: string;
  issues?: { message: string }[];
}

function describeError(error: unknown, fallback: string): { message: string; code?: string } {
  if (error && typeof error === "object") {
    const body = error as OakErrorBody;
    if (typeof body.message === "string") return { message: body.message, code: body.code };
  }
  return { message: fallback };
}

/**
 * Calls a GET endpoint on `client` and returns its parsed JSON body, or throws a typed
 * `OakApiError` for any non-2xx response.
 */
export async function oakGet<Path extends ClientPathsWithMethod<OakClient, "get">>(
  client: OakClient,
  path: Path,
  init?: MaybeOptionalInit<paths[Path], "get">,
): Promise<MethodResponse<OakClient, "get", Path>> {
  const { data, error, response } = await client.GET(path, init as never);
  if (error !== undefined || !response.ok) {
    if (response.status === 429) {
      const state = lastKnownRateLimit(client);
      throw new OakRateLimitError(String(path), state ? new Date(state.reset) : null);
    }
    const { message, code } = describeError(error, response.statusText || "request failed");
    throw new OakApiError(response.status, String(path), message, { code, body: error });
  }
  return data as MethodResponse<OakClient, "get", Path>;
}
