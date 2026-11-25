/**
 * GET — where this lesson attempt really is, according to the server.
 *
 * The page asks on opening and every few seconds. Swiping back on an iPad shows the lesson
 * as the browser remembered it (often the starter of a lesson already finished), and a
 * parent may have moved the child on from another device; either way the page sees the
 * difference here and catches up instead of showing the past.
 */
import { jsonError, requireStudentApi, ApiError } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const attempt = await prisma.lessonAttempt.findUnique({
      where: { id: attemptId },
      select: { studentId: true, status: true, currentStage: true },
    });
    if (!attempt || attempt.studentId !== user.studentProfile.id) throw new ApiError(404, "Not found");
    return Response.json(
      { status: attempt.status, currentStage: attempt.currentStage },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
