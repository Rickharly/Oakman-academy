/**
 * Read-only access for whoever maintains the app, without a parent's login.
 *
 * Every fix to this app has been diagnosed from a machine that cannot see the children's data,
 * so "the kids have the same classes" gets reasoned about instead of looked at. This lets the
 * diagnostics report be read with a long random token held only in the hosting platform's
 * environment (`OPS_READ_TOKEN`) and the maintainer's credential store — never in the repo.
 *
 * Off unless the variable is set, and refused if it is too short to be a real secret. Compared
 * in constant time over digests, so neither the length nor a prefix of the token leaks through
 * timing.
 */
import { createHash, timingSafeEqual } from "node:crypto";

const MIN_TOKEN_LENGTH = 32;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** True only when the request carries `Authorization: Bearer <OPS_READ_TOKEN>`. */
export function hasOpsReadToken(req: Request, expected = process.env.OPS_READ_TOKEN): boolean {
  if (!expected || expected.trim().length < MIN_TOKEN_LENGTH) return false;
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  return timingSafeEqual(digest(match[1].trim()), digest(expected.trim()));
}
