import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { recordTime } from "@/lib/lessons/service";
import { recordTimeBreakdown } from "@/lib/engagement/service";

const bodySchema = z.object({
  seconds: z.number().min(0),
  /** How that time was spent. Older clients send only `seconds`; it all counts as active then. */
  activeSeconds: z.number().min(0).optional(),
  idleSeconds: z.number().min(0).optional(),
  awaySeconds: z.number().min(0).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    const studentId = user.studentProfile.id;

    await recordTime(attemptId, studentId, body.seconds);
    await recordTimeBreakdown(attemptId, studentId, {
      activeSeconds: body.activeSeconds ?? body.seconds,
      idleSeconds: body.idleSeconds ?? 0,
      awaySeconds: body.awaySeconds ?? 0,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
