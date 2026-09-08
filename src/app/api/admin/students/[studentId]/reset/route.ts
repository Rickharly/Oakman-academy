import { z } from "zod";
import { jsonError, ApiError } from "@/lib/auth/api";
import { requireParentOfStudent } from "@/lib/auth/session";
import { resetStudentProgress } from "@/lib/admin/reset";

/**
 * Wipes a child's learning history back to a first login.
 *
 * Guarded by typing the child's name: this is the one place in the app that deletes learning
 * history, and it should not be one mis-click away.
 */
export async function POST(req: Request, ctx: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await ctx.params;
    const { student } = await requireParentOfStudent(studentId);
    const body = z.object({ confirm: z.string() }).parse(await req.json());

    if (body.confirm.trim().toLowerCase() !== student.user.displayName.trim().toLowerCase()) {
      throw new ApiError(400, `Type "${student.user.displayName}" to confirm.`);
    }

    const summary = await resetStudentProgress(studentId);
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: "Unrecognised request" }, { status: 400 });
    return jsonError(err);
  }
}
