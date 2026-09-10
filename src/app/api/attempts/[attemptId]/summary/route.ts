import { requireStudentApi, jsonError, ApiError } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

/**
 * The teacher's end-of-lesson note, once it has been written.
 *
 * Written behind the submit rather than during it, so a child gets their marks the moment they
 * are ready instead of waiting on a paragraph. The feedback page asks for it a moment later.
 */
export async function GET(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const attempt = await prisma.lessonAttempt.findUnique({
      where: { id: attemptId },
      select: { studentId: true, feedbackSummary: true },
    });
    if (!attempt) throw new ApiError(404, "Lesson attempt not found");
    if (attempt.studentId !== user.studentProfile.id) throw new ApiError(403, "Not your lesson attempt");
    return Response.json({ feedbackSummary: attempt.feedbackSummary });
  } catch (err) {
    return jsonError(err);
  }
}
