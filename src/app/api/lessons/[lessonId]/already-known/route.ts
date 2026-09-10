import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { markAlreadyLearned } from "@/lib/lessons/already-known";

/**
 * A child saying they have already been taught this lesson.
 *
 * Scoped to the child making the request — nobody can mark anybody else's lesson — and it never
 * writes a score, because nothing here was assessed. See `already-known.ts`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { lessonId } = await ctx.params;
    const body = await req
      .json()
      .then((v) =>
        z
          .object({ assignmentId: z.string().nullish(), note: z.string().max(500).nullish() })
          .partial()
          .parse(v),
      )
      .catch(() => ({ assignmentId: null, note: null }));

    const result = await markAlreadyLearned(user.studentProfile.id, lessonId, {
      assignmentId: body.assignmentId ?? null,
      note: body.note ?? null,
    });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
