import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { StudentProfile, User } from "@/generated/prisma/client";

export const SESSION_COOKIE = "fs_session";

/**
 * How long a session lasts.
 *
 * "Remember me" is the difference between a shared family iPad the parent picks up twice a day
 * and a device they are only borrowing. Remembered sessions last a term; the rest last a
 * working day, which is long enough to finish what you sat down to do and short enough that a
 * borrowed device does not stay logged in to a child's records.
 */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REMEMBERED_TTL_MS = 120 * 24 * 60 * 60 * 1000; // a school term and then some
const SHORT_TTL_MS = 12 * 60 * 60 * 1000; // one day

/** How long a new session should last. Pure, so the decision itself can be tested. */
export function sessionTtlMs(remember?: boolean): number {
  if (remember === true) return REMEMBERED_TTL_MS;
  if (remember === false) return SHORT_TTL_MS;
  return SESSION_TTL_MS;
}
const REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // refresh when < 15 days left

export type SessionUser = {
  id: string;
  role: "PARENT" | "STUDENT";
  displayName: string;
  avatar: string | null;
  email: string | null;
  username: string | null;
  studentProfile: {
    id: string;
    yearGroup: number;
    keyStage: string;
    preferences: unknown;
    lessonsPerDay: number;
    lessonMinutes: number;
    breakMinutes: number;
    schoolStartTime: string;
    /** Personalisation a parent set: how old they are, what they like, how they are taught. */
    age: number | null;
    interests: string[];
    teacherNotes: string | null;
    voiceId: string | null;
    voiceEnabled: boolean;
  } | null;
};

export type StudentSessionUser = SessionUser & {
  studentProfile: NonNullable<SessionUser["studentProfile"]>;
};

type UserWithProfile = User & { studentProfile: StudentProfile | null };

function toSessionUser(user: UserWithProfile): SessionUser {
  return {
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    avatar: user.avatar,
    email: user.email,
    username: user.username,
    studentProfile: user.studentProfile
      ? {
          id: user.studentProfile.id,
          yearGroup: user.studentProfile.yearGroup,
          keyStage: user.studentProfile.keyStage,
          preferences: user.studentProfile.preferences,
          lessonsPerDay: user.studentProfile.lessonsPerDay,
          lessonMinutes: user.studentProfile.lessonMinutes,
          breakMinutes: user.studentProfile.breakMinutes,
          schoolStartTime: user.studentProfile.schoolStartTime,
          age: user.studentProfile.age,
          interests: Array.isArray(user.studentProfile.interests)
            ? (user.studentProfile.interests as unknown[]).filter((v): v is string => typeof v === "string")
            : [],
          teacherNotes: user.studentProfile.teacherNotes,
          voiceId: user.studentProfile.voiceId,
          voiceEnabled: user.studentProfile.voiceEnabled,
        }
      : null,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

function parseCookieHeader(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

/**
 * Looks up the session by opaque token, sliding the expiry forward when it is
 * getting close (< 15 days left), and returns the mapped user or null.
 * When `refreshCookie` is true and the expiry was extended, best-effort
 * re-sets the response cookie (only possible from a Server Action / Route
 * Handler — silently skipped when called during render).
 */
async function loadSessionUser(token: string, opts?: { refreshCookie?: boolean }): Promise<SessionUser | null> {
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { studentProfile: true } } },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (session.expiresAt.getTime() - now < REFRESH_THRESHOLD_MS) {
    // Extend by however long this session was originally granted, so a remembered login is
    // not quietly demoted to a short one the first time it refreshes.
    const granted = session.expiresAt.getTime() - session.createdAt.getTime();
    const expiresAt = new Date(now + Math.max(SESSION_TTL_MS, granted));
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt } });
    if (opts?.refreshCookie) {
      try {
        const store = await cookies();
        store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
      } catch {
        // Called from a Server Component render, where cookies() cannot be mutated.
        // The session's expiresAt is still refreshed server-side.
      }
    }
  }

  return toSessionUser(session.user);
}

/** Reads the current session from the request cookie jar. Returns null when absent/invalid. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadSessionUser(token, { refreshCookie: true });
}

/** For route handlers: reads the session from a raw Request's Cookie header. No redirect. */
export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  const token = parseCookieHeader(req.headers.get("cookie"));
  if (!token) return null;
  return loadSessionUser(token);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireStudent(): Promise<StudentSessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT" || !user.studentProfile) {
    redirect("/student-login");
  }
  return user as StudentSessionUser;
}

export async function requireParent(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    redirect("/login");
  }
  return user;
}

/** Parent must be linked to the student; otherwise notFound(). Returns profile with user. */
export async function requireParentOfStudent(
  studentProfileId: string
): Promise<{ parent: SessionUser; student: StudentProfile & { user: User } }> {
  const parent = await requireParent();

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: { user: true },
  });
  if (!student) notFound();

  const link = await prisma.parentStudentLink.findUnique({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.userId } },
  });
  if (!link) notFound();

  return { parent, student };
}

/** Creates a new session for userId, sets the cookie, and returns the token + expiry. */
export async function createSession(
  userId: string,
  opts: { remember?: boolean } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionTtlMs(opts.remember));

  await prisma.session.create({ data: { tokenHash, userId, expiresAt } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));

  return { token, expiresAt };
}

/** Deletes the current session row (if any) and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}
