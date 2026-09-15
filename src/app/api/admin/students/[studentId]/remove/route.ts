import { z } from "zod";
import { jsonError, ApiError, requireParentForRemovalApi } from "@/lib/auth/api";
import { removeStudentAccount } from "@/lib/admin/remove";

/**
 * Permanently deletes a student's account — the User row, the StudentProfile, and every row of
 * their learning history with it.
 *
 * A dedicated route (rather than another `action` on `POST /api/admin/students`) because it is
 * destructive in a way none of that route's actions are, and this app already has exactly one
 * precedent for that: `POST /api/admin/students/[studentId]/reset`. Keeping "remove" as a
 * sibling of "reset" under the student's own path keeps the one truly dangerous verb (delete
 * everything, irreversibly) out of the same discriminated union as create/update/resetPin,
 * and out of the same handler as the guard that must never accidentally reach a parent's own
 * account.
 *
 * Guarded by typing the child's name, exactly like reset: this and reset are the only two
 * places in the app that destroy data, and neither should be one mis-click away.
 */
export async function POST(req: Request, ctx: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await ctx.params;
    const { student } = await requireParentForRemovalApi(req, studentId);
    const body = z.object({ confirm: z.string() }).parse(await req.json());

    if (body.confirm.trim().toLowerCase() !== student.user.displayName.trim().toLowerCase()) {
      throw new ApiError(400, `Type "${student.user.displayName}" to confirm.`);
    }

    const summary = await removeStudentAccount(studentId);
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: "Unrecognised request" }, { status: 400 });
    return jsonError(err);
  }
}
