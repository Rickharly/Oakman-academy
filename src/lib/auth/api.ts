import type { StudentProfile, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, type SessionUser, type StudentSessionUser } from "@/lib/auth/session";

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
