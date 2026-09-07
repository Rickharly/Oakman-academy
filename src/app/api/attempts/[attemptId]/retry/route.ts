import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { retryQuestion } from "@/lib/lessons/service";

const bodySchema = z.object({ questionId: z.string() });

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());

    await retryQuestion(attemptId, user.studentProfile.id, body.questionId);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
