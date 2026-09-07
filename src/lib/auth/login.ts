import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { Role } from "@/generated/prisma/client";
import type { User } from "@/generated/prisma/client";

// A valid bcrypt hash (cost 10) of an unused secret. Compared against when no
// matching user exists so a missing-account lookup still pays the bcrypt cost
// and doesn't leak account existence via response timing.
const DUMMY_HASH = "$2b$10$SU0OMESjb1Hj2EfzFegx9ecTihm/rlv8BphSCXQH8s9cLGM4av6g2";

/** Parent login by email + password. Returns the user row or null. */
export async function loginParent(email: string, password: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || user.role !== Role.PARENT || !valid) return null;
  return user;
}

/** Student login by username + PIN. Returns the user row or null. */
export async function loginStudent(username: string, pin: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  const valid = await verifyPassword(pin, user?.passwordHash ?? DUMMY_HASH);
  if (!user || user.role !== Role.STUDENT || !valid) return null;
  return user;
}

/** Avatars for the student login picker. No secrets. */
export async function listStudentAvatars(): Promise<
  { username: string; displayName: string; avatar: string | null }[]
> {
  const students = await prisma.user.findMany({
    where: { role: Role.STUDENT, username: { not: null } },
    select: { username: true, displayName: true, avatar: true },
    orderBy: { displayName: "asc" },
  });
  return students
    .filter((s): s is { username: string; displayName: string; avatar: string | null } => s.username !== null)
    .map((s) => ({ username: s.username, displayName: s.displayName, avatar: s.avatar }));
}
