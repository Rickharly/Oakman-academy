import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { completeStage } from "@/lib/lessons/service";

const bodySchema = z.object({
  stage: z.enum(["STARTER", "LEARN", "PRACTICE", "CHECK", "FEEDBACK", "COMPLETE"]),
  action: z.literal("complete"),
});

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());

    const attempt = await completeStage(attemptId, user.studentProfile.id, body.stage);
    return Response.json({ attempt });
  } catch (err) {
    return jsonError(err);
  }
}
