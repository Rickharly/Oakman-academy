/**
 * The tutoring loop: find out what was not understood, and work at it until it is.
 *
 * One endpoint with three moves, because they are one conversation:
 *   diagnose — what did they not get, from what they actually wrote
 *   reteach  — explain it again, a different way from every previous round
 *   explain  — they say it back in their own words, and the teacher judges it
 *
 * Every move is scoped to the signed-in student's own attempt. Nothing here trusts the client
 * for who the child is or which lesson they are on.
 */
import { z } from "zod";
import { plainMathsDeep } from "@/lib/text/maths";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireStudentApi } from "@/lib/auth/api";
import {
  diagnoseGaps,
  judgeExplainBack,
  openGaps,
  parkOpenGaps,
  reteach,
} from "@/lib/lessons/understanding";

export const maxDuration = 120;

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("diagnose"), attemptId: z.string() }),
  z.object({ action: z.literal("reteach"), attemptId: z.string(), gapId: z.string() }),
  z.object({
    action: z.literal("explain"),
    attemptId: z.string(),
    gapId: z.string(),
    text: z.string().min(1).max(2000),
  }),
  z.object({ action: z.literal("park"), attemptId: z.string() }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { lessonId } = await ctx.params;
    const studentId = user.studentProfile.id;

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid request");
    const body = parsed.data;

    // The attempt must be this child's, and must be this lesson. Both, not either.
    const attempt = await prisma.lessonAttempt.findFirst({
      where: { id: body.attemptId, studentId, lessonId },
      select: { id: true },
    });
    if (!attempt) throw new ApiError(404, "Lesson attempt not found");

    switch (body.action) {
      case "diagnose": {
        const gaps = await diagnoseGaps(body.attemptId, studentId);
        // The tutor's own words, in notation the page can draw. This is the part of the app a
        // child reads when they have already said they do not understand.
        return Response.json({
          gaps: gaps.map((g) =>
            plainMathsDeep({
              id: g.id,
              concept: g.concept,
              status: g.status,
              round: g.round,
              explanation: g.lastExplanation,
            }),
          ),
        });
      }
      case "reteach": {
        const result = await reteach(body.gapId, studentId);
        // Null means every approach has been tried. Grinding on is not tutoring.
        return Response.json({ explanation: plainMathsDeep(result), exhausted: result === null });
      }
      case "explain": {
        const verdict = await judgeExplainBack(body.gapId, studentId, body.text);
        if (!verdict) throw new ApiError(404, "That is not one of your gaps");
        const remaining = await openGaps(body.attemptId, studentId);
        return Response.json({ verdict: plainMathsDeep(verdict), remaining: remaining.length });
      }
      case "park": {
        const parked = await parkOpenGaps(body.attemptId, studentId);
        return Response.json({ parked });
      }
    }
  } catch (err) {
    return jsonError(err);
  }
}
