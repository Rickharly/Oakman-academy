import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { teacherAgent } from "@/lib/ai/teacher-agent";


/**
 * Writes practice questions for a lesson that shipped its practice as a worksheet PDF.
 *
 * Called by the player when the practice stage has nothing to do. Generating on demand rather
 * than for every lesson at import time means we only pay for lessons a child actually reaches.
 */
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { lessonId } = await ctx.params;

    // The questions they got wrong, when this is a "practise what I missed" request. Aimed
    // practice beats another round of the same quiz.
    const body = await req
      .json()
      .then((v) => z.object({ missedPrompts: z.array(z.string()).max(20) }).partial().parse(v))
      .catch(() => ({ missedPrompts: undefined }));

    const questions = await teacherAgent.generateLessonPractice({
      studentId: user.studentProfile.id,
      lessonId,
      missedPrompts: body.missedPrompts,
    });

    // Only what the player needs. The answer key never leaves the server.
    return Response.json({
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        stage: "PRACTICE" as const,
        prompt: q.prompt,
        promptImage: q.promptImage,
        options: q.options,
        maxScore: q.maxScore,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
