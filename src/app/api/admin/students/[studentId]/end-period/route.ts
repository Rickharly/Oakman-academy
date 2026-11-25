/** POST — a parent ends the period one of their own children is in. See `parent-move.ts`. */
import { jsonError, requireParentOfStudentApi } from "@/lib/auth/api";
import { endPeriodNow } from "@/lib/lessons/parent-move";

export async function POST(req: Request, ctx: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await ctx.params;
    const { student } = await requireParentOfStudentApi(req, studentId);
    return Response.json(await endPeriodNow(student.id));
  } catch (err) {
    return jsonError(err);
  }
}
