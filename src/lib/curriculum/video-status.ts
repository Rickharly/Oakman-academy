/**
 * Whether a lesson resource's stored address is actually something we can fetch, and — when
 * it exists but is not — why the child's video slot is empty.
 *
 * Shared between the lesson player (client) and the sync/diagnostics code (server) so "is this
 * address fetchable" and "is this the bundled sample curriculum" are decided in exactly one
 * place. Two different readings of the same address is how "the video is blurred out" stayed a
 * mystery for days: a server check and the player were each guessing independently.
 *
 * Deliberately dependency-free (no Prisma, no Next.js, no server-only imports) so it can be
 * imported from a "use client" component as well as from server code.
 */

/**
 * Whether a resource's address points at something that can actually be fetched.
 *
 * The bundled placeholder curriculum lists its videos as `fixture://…`, which is not an address
 * — nothing can fetch it, and the failure is "unknown scheme" deep inside a stream. Treating
 * those rows as a video gave a child a black player stuck at 0:00 on every lesson, which looks
 * exactly like a real video failing to load. That is why "the video is broken" was the story
 * for days when the truth was that there was no real video.
 *
 * A stored file is fine. An http(s) address is fine. A path with no scheme is fine — the server
 * resolves it against the provider's base. Anything else is a placeholder pretending.
 */
export function isPlayableUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (/^https?:\/\//i.test(url)) return true;
  return !url.includes("://");
}

/** Same question, asked of a whole resource row (a stored file always wins). */
export function isPlayableResource(resource: { providerUrl: string | null; storedPath: string | null }): boolean {
  if (resource.storedPath) return true;
  return isPlayableUrl(resource.providerUrl);
}

/**
 * Whether an address is specifically the bundled sample curriculum's made-up placeholder, as
 * opposed to some other non-fetchable value. Worth telling apart: a placeholder is not a video
 * that failed to download, it is a lesson that was never real teaching material.
 */
export function isPlaceholderUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.toLowerCase().startsWith("fixture://");
}

/**
 * Why a lesson has no video a child can watch, computed once on the server and carried down to
 * the player so its panel can say something true instead of "there's no video" to a child who
 * can see perfectly well that Oak's own site has one.
 *
 * - `placeholder_curriculum` — this lesson (or its video row) is from the bundled sample
 *   curriculum, which has nothing real to show. See `todaysVideosCheck` in
 *   `src/lib/admin/diagnostics.ts`, which reports the same fact to parents.
 * - `provider_had_none` — Oak was asked for this lesson's assets and answered; it simply has
 *   no video.
 * - `fetch_failed` — Oak was asked just now and the request itself failed (network, quota).
 * - `never_imported` — nobody has successfully asked Oak for this lesson's assets yet.
 */
export type VideoUnavailableReason =
  | "placeholder_curriculum"
  | "provider_had_none"
  | "fetch_failed"
  | "never_imported";

/**
 * Works out which of the four reasons above applies, from facts the lesson page already has to
 * hand. A pure function on purpose — the lesson page composes it with a real database read and
 * a real provider call, but the decision itself has no I/O in it, so it can be tested without
 * either.
 *
 * Returns `undefined` whenever a VIDEO resource row exists at all — playable or not — because
 * at that point the player can read the rest (a real address, or a placeholder one) straight off
 * the row, without being told why by the server.
 */
export function deriveVideoUnavailableReason(input: {
  hasVideoResource: boolean;
  lessonProvider: string;
  assetsSyncedAt: Date | null;
  /**
   * Whether *this* lesson-open's own attempt to fetch assets came back as a definite failure
   * (a network error, a quota, an exception) rather than merely not finishing in time or never
   * having been tried at all.
   */
  fetchFailedJustNow: boolean;
}): VideoUnavailableReason | undefined {
  if (input.hasVideoResource) return undefined;
  // The bundled placeholder curriculum was never going to have a video no matter how many
  // times it is asked — say that, rather than something that reads as "not yet".
  if (input.lessonProvider === "fixture") return "placeholder_curriculum";
  // Assets have been read from the provider before (this open's attempt or an earlier one) and
  // there was no video in them.
  if (input.assetsSyncedAt) return "provider_had_none";
  if (input.fetchFailedJustNow) return "fetch_failed";
  return "never_imported";
}
