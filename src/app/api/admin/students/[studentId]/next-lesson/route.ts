/** POST — a parent moves one of their own children on to the next lesson. See `parent-move.ts`. */
import { jsonError, requireParentOfStudentApi } from "@/lib/auth/api";
import { moveToNextLesson } from "@/lib/lessons/parent-move";

export async function POST(req: Request, ctx: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await ctx.params;
    const { student } = await requireParentOfStudentApi(req, studentId);
    return Response.json(await moveToNextLesson(student.id));
  } catch (err) {
    return jsonError(err);
  }
}
