import { z } from "zod";
import type { Question } from "@/generated/prisma/client";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { countGradedAttempts, submitStage } from "@/lib/lessons/service";

const bodySchema = z.object({ stage: z.enum(["STARTER", "PRACTICE", "CHECK"]) });

/** STARTER/PRACTICE always reveal; CHECK reveals only once no retry remains. */
async function shouldReveal(
  stage: "STARTER" | "PRACTICE" | "CHECK",
  activityAttemptId: string,
  questionId: string,
  isCorrect: boolean | null
): Promise<boolean> {
  if (stage !== "CHECK") return true;
  if (isCorrect) return true;
  const gradedCount = await countGradedAttempts(activityAttemptId, questionId);
  return gradedCount >= 2;
}

function withoutAnswerKey(question: Question) {
  const { answerKey: _answerKey, explanation: _explanation, ...rest } = question;
  void _answerKey;
  void _explanation;
  return { ...rest, answerKey: undefined, explanation: null };
}

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());

    const { activity, results } = await submitStage(attemptId, user.studentProfile.id, body.stage);

    const shapedResults = await Promise.all(
      results.map(async (r) => {
        const reveal = await shouldReveal(body.stage, activity.id, r.questionId, r.isCorrect);
        const { question, ...rest } = r;
        return { ...rest, question: reveal ? question : withoutAnswerKey(question) };
      })
    );

    return Response.json({ activity, results: shapedResults });
  } catch (err) {
    return jsonError(err);
  }
}
