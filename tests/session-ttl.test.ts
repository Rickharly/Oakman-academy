import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, SESSION_COOKIE } from "@/lib/auth/session";
import { resetDb } from "./helpers/db";

/**
 * Regression tests for commit eed2064: a session used to roll forward to a flat thirty days
 * the first time it refreshed inside a fifteen-day window, regardless of how long it was
 * originally granted — so unticking "keep me signed in" did nothing in practice. It now rolls
 * forward by the length it was granted, once half of that length has been used.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function createTestSessionWithTtl(userId: string, createdAt: Date, expiresAt: Date) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = await prisma.session.create({
    data: { tokenHash, userId, createdAt, expiresAt },
  });
  return { token, sessionId: session.id };
}

function requestWith(token: string) {
  return new Request("http://localhost/api/whatever", {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
}

describe("session refresh rolls forward by the granted length", () => {
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    const user = await prisma.user.create({
      data: { role: "PARENT", email: "parent@example.com", passwordHash: "x", displayName: "Parent" },
    });
    userId = user.id;
  });

  it("a 12-hour (unticked) session with 5 hours left extends to ~12h from now, not 30 days", async () => {
    const now = Date.now();
    const createdAt = new Date(now - 7 * HOUR);
    const expiresAt = new Date(now + 5 * HOUR); // 12h granted, well inside any 15-day window
    const { token, sessionId } = await createTestSessionWithTtl(userId, createdAt, expiresAt);

    const user = await getSessionFromRequest(requestWith(token));
    expect(user).not.toBeNull();

    const refreshed = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const remainingMs = refreshed.expiresAt.getTime() - now;

    // Extended by ~12h, not demoted (it wasn't) nor promoted to 30 days.
    expect(remainingMs).toBeGreaterThan(11 * HOUR);
    expect(remainingMs).toBeLessThan(13 * HOUR);
  });

  it("a 120-day (remembered) session close to expiry keeps 120-day extensions", async () => {
    const now = Date.now();
    const REMEMBERED = 120 * DAY;
    const createdAt = new Date(now - REMEMBERED + 10 * DAY); // 10 days left of a 120-day grant
    const expiresAt = new Date(now + 10 * DAY);
    const { token, sessionId } = await createTestSessionWithTtl(userId, createdAt, expiresAt);

    await getSessionFromRequest(requestWith(token));

    const refreshed = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const remainingMs = refreshed.expiresAt.getTime() - now;

    expect(remainingMs).toBeGreaterThan(119 * DAY);
    expect(remainingMs).toBeLessThan(121 * DAY);
  });

  it("a 30-day (default) session close to expiry stays a 30-day extension", async () => {
    const now = Date.now();
    const TTL = 30 * DAY;
    const createdAt = new Date(now - TTL + 10 * DAY); // 10 days left of a 30-day grant
    const expiresAt = new Date(now + 10 * DAY);
    const { token, sessionId } = await createTestSessionWithTtl(userId, createdAt, expiresAt);

    await getSessionFromRequest(requestWith(token));

    const refreshed = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const remainingMs = refreshed.expiresAt.getTime() - now;

    expect(remainingMs).toBeGreaterThan(29 * DAY);
    expect(remainingMs).toBeLessThan(31 * DAY);
  });

  it("does not refresh a session that still has more than half its granted time left", async () => {
    const now = Date.now();
    const TTL = 30 * DAY;
    const createdAt = new Date(now - 1 * DAY); // 29 days left of 30 — well over half
    const expiresAt = new Date(createdAt.getTime() + TTL);
    const { token, sessionId } = await createTestSessionWithTtl(userId, createdAt, expiresAt);

    await getSessionFromRequest(requestWith(token));

    const untouched = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(untouched.expiresAt.getTime()).toBe(expiresAt.getTime());
  });
});
