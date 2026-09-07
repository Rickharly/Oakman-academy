import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { recordVideoProgress } from "@/lib/lessons/service";

const bodySchema = z.object({
  percentWatched: z.number().min(0).max(100),
  positionSeconds: z.number().min(0),
  completed: z.boolean(),
});

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());

    await recordVideoProgress(attemptId, user.studentProfile.id, body);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
