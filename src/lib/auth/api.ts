import type { StudentProfile, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, type SessionUser, type StudentSessionUser } from "@/lib/auth/session";
import { studentHasLearningRecord } from "@/lib/admin/remove";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/** Maps ApiError to `{ error }` with its status; anything else becomes a 500. */
export function jsonError(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

export async function requireUserApi(req: Request): Promise<SessionUser> {
  const user = await getSessionFromRequest(req);
  if (!user) throw new ApiError(401, "Not authenticated");
  return user;
}

export async function requireStudentApi(req: Request): Promise<StudentSessionUser> {
  const user = await requireUserApi(req);
  if (user.role !== "STUDENT" || !user.studentProfile) {
    throw new ApiError(403, "Student account required");
  }
  return user as StudentSessionUser;
}

export async function requireParentApi(req: Request): Promise<SessionUser> {
  const user = await requireUserApi(req);
  if (user.role !== "PARENT") {
    throw new ApiError(403, "Parent account required");
  }
  return user;
}

/**
 * The parent, and one of their own children by profile id.
 *
 * For route handlers. The page-side `requireParentOfStudent` answers by redirecting, and a
 * redirect thrown inside a handler's try/catch comes out as a 500 with a stack trace rather
 * than a 401 — which is what happened to the record and reset routes.
 */
export async function requireParentOfStudentApi(
  req: Request,
  studentProfileId: string,
): Promise<{ parent: SessionUser; student: StudentProfile & { user: User } }> {
  const parent = await requireParentApi(req);
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: { user: true },
  });
  if (!student) throw new ApiError(404, "Student not found");
  const link = await prisma.parentStudentLink.findUnique({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.userId } },
  });
  if (!link) throw new ApiError(404, "Student not found");
  return { parent, student };
}

/**
 * The parent, and a student profile they are allowed to remove: one of their own linked
 * children, OR an unlinked student profile that has never been used.
 *
 * The unlinked case is deliberate, not a hole: a test student created and then left unlinked
 * (a bug, an abandoned setup) is exactly the kind of account a parent wants gone, but the
 * ordinary "parent of this student" guard 404s on it because no link exists to check — which
 * would leave the parent unable to remove the very account they are trying to get rid of.
 *
 * But an unlinked profile is not automatically ownerless: it could be a real child's account
 * whose link row was lost some other way, and a display name and a guessed id are all that
 * separates "my abandoned test account" from "somebody else's child" to whoever is asking. So
 * this only takes the orphan path when the profile also has no learning record at all —
 * `studentHasLearningRecord` (src/lib/admin/remove.ts), the same table set `resetStudentProgress`
 * treats as "the child's record". Nothing attempted, nothing assigned, nothing recorded means
 * nobody has ever actually used the account, which is the one case where "no link" really does
 * mean "no owner to protect". An unlinked profile *with* a record is refused, with a message
 * that says why rather than a bare 404, so the parent knows what happened instead of being
 * left to guess — see the route for the resulting status.
 *
 * A profile linked to a *different* parent still 404s here exactly as `requireParentOfStudentApi`
 * does, whether or not it has history: that case has a real owner, so it is hidden rather than
 * explained.
 *
 * The role check runs before any of that: whatever the link state, this must never be able to
 * reach a parent's own `User` row. It has its own explicit check and its own message — this is
 * the guard that matters most, since a parent's account is also just a `User` a student profile
 * lookup could never accidentally return, but the id in the request body is client-supplied and
 * must never be trusted to actually name a student.
 */
export async function requireParentForRemovalApi(
  req: Request,
  studentProfileId: string,
): Promise<{ parent: SessionUser; student: StudentProfile & { user: User } }> {
  const parent = await requireParentApi(req);
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: { user: true },
  });
  if (!student) throw new ApiError(404, "Student not found");

  if (student.user.role !== "STUDENT") {
    throw new ApiError(400, "Only student accounts can be removed.");
  }

  const link = await prisma.parentStudentLink.findUnique({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.userId } },
  });
  if (link) return { parent, student };

  const linkedToAnyone = await prisma.parentStudentLink.findFirst({ where: { studentId: student.userId } });
  if (linkedToAnyone) throw new ApiError(404, "Student not found");

  // Orphaned profile: only safe to remove this way when nobody has ever actually used it.
  const hasRecord = await studentHasLearningRecord(student.id);
  if (hasRecord) {
    throw new ApiError(
      403,
      "This account has a learning record and isn't linked to you, so it can't be removed this way.",
    );
  }
  return { parent, student };
}
