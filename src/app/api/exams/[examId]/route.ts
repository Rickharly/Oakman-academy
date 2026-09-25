import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { saveExamAnswer, submitExam } from "@/lib/exams/service";

/** An exam has no teacher in it, so this endpoint only ever saves answers or marks the paper. */
export const maxDuration = 120;

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), examQuestionId: z.string(), response: z.unknown() }),
  z.object({ action: z.literal("submit") }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ examId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { examId } = await ctx.params;
    const body = bodySchema.parse(await req.json());

    if (body.action === "answer") {
      await saveExamAnswer(body.examQuestionId, user.studentProfile.id, body.response);
      return Response.json({ ok: true });
    }

    const result = await submitExam(examId, user.studentProfile.id);
    return Response.json({
      scorePct: Math.round(result.scorePct),
      grade: result.grade,
      meaning: result.meaning,
      topics: result.topics,
      weakTopics: result.weakTopics,
      missed: result.missed,
    });
  } catch (err) {
    return jsonError(err);
  }
}
