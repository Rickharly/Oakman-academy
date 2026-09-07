import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { saveDraftAnswer } from "@/lib/lessons/service";

const bodySchema = z.object({ questionId: z.string(), response: z.unknown() });

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());

    await saveDraftAnswer(attemptId, user.studentProfile.id, body.questionId, body.response);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
