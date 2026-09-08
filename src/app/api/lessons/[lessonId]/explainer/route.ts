/**
 * POST /api/lessons/[lessonId]/explainer — the lesson, taught in words.
 *
 * Generated on first request and stored, so the second child through the same lesson gets it
 * instantly and free. Called by the player when a lesson's Learn step has no video.
 */
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { getOrCreateExplainer } from "@/lib/lessons/explainer";

export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { lessonId } = await ctx.params;
    // The child's own interests steer which everyday thing the lesson is explained with.
    const explainer = await getOrCreateExplainer(lessonId, { studentId: user.studentProfile.id });
    // Null is an answer, not a failure: this lesson has nothing to teach from. The player
    // says so plainly rather than showing a child an error they cannot act on.
    return Response.json({ explainer });
  } catch (err) {
    return jsonError(err);
  }
}
