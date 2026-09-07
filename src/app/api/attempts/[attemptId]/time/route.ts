import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { recordTime } from "@/lib/lessons/service";

const bodySchema = z.object({ seconds: z.number().min(0) });

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());

    await recordTime(attemptId, user.studentProfile.id, body.seconds);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
