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
