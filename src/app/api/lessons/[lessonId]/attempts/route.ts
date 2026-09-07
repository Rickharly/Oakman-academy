import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { startOrResumeAttempt } from "@/lib/lessons/service";

const bodySchema = z.object({ assignmentId: z.string().optional() });

export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { lessonId } = await ctx.params;
    const raw = await req.json().catch(() => ({}));
    const body = bodySchema.parse(raw);

    const attempt = await startOrResumeAttempt(user.studentProfile.id, lessonId, body.assignmentId);
    return Response.json({ attemptId: attempt.id, stage: attempt.currentStage });
  } catch (err) {
    return jsonError(err);
  }
}
