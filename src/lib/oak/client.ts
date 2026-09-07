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

/** Oak enforces 10 req/s; we throttle a little under that to leave headroom for jitter. */
const MAX_REQUESTS_PER_SECOND = 8;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429]);

export interface OakClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Override the underlying fetch (tests only); defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
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

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateMs = Date.parse(retryAfter);
    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  // exponential backoff: 300ms, 600ms, 1200ms
  return 300 * 2 ** (attempt - 1);
}

/** Wraps a fetch implementation with the throttle + retry policy described above. */
function throttledRetryFetch(baseFetch: typeof fetch, throttle: Throttle): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let attempt = 0;
    for (;;) {
      await throttle.acquire();
      const response = await baseFetch(input, init);
      const shouldRetry =
        (RETRYABLE_STATUSES.has(response.status) || response.status >= 500) && attempt < MAX_RETRIES;
      if (!shouldRetry) return response;
      attempt += 1;
      await sleep(retryDelayMs(response, attempt));
    }
  }) as typeof fetch;
}

/** Creates a typed Oak Open API client with auth, throttling and retry wired in. */
export function createOakClient(options: OakClientOptions): OakClient {
  const throttle = new Throttle(MAX_REQUESTS_PER_SECOND);
  const baseFetch = options.fetch ?? globalThis.fetch;

  return createClient<paths>({
    baseUrl: options.baseUrl ?? DEFAULT_OAK_BASE_URL,
    headers: { Authorization: `Bearer ${options.apiKey}` },
    fetch: throttledRetryFetch(baseFetch, throttle),
  });
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
    const { message, code } = describeError(error, response.statusText || "request failed");
    throw new OakApiError(response.status, String(path), message, { code, body: error });
  }
  return data as MethodResponse<OakClient, "get", Path>;
}
