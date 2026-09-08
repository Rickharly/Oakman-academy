import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { teacherAgent } from "@/lib/ai/teacher-agent";
import { buildWorksheetPractice } from "@/lib/lessons/worksheet";


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
      .then((v) => z.object({ missedPrompts: z.array(z.string()).max(20), extension: z.boolean() }).partial().parse(v))
      .catch(() => ({ missedPrompts: undefined, extension: undefined }));

    // The lesson's own worksheet first. Questions invented from the lesson are a reasonable
    // stand-in for a worksheet we cannot read; they are not better than the worksheet the
    // teacher who wrote the lesson chose. Only for plain practice — a child asking for more, or
    // for practice on what they missed, wants something new.
    if (!body.extension && !body.missedPrompts?.length) {
      const fromWorksheet = await buildWorksheetPractice(lessonId).catch((err: unknown) => {
        console.error("[practice] worksheet could not be read; falling back", err);
        return [];
      });
      if (fromWorksheet.length > 0) {
        return Response.json({
          source: "worksheet",
          questions: fromWorksheet.map((q) => ({
            id: q.id,
            type: q.type,
            stage: "PRACTICE" as const,
            prompt: q.prompt,
            promptImage: q.promptImage,
            options: q.options,
            maxScore: q.maxScore,
          })),
        });
      }
    }

    let questions = await teacherAgent
      .generateLessonPractice({
        studentId: user.studentProfile.id,
        lessonId,
        missedPrompts: body.missedPrompts,
        extension: body.extension,
      })
      .catch((err: unknown) => {
        // A child with twenty minutes left and a finished lesson must not be left with a dead
        // button because the model was slow or refused. Log the real reason for us, and fall
        // through to whatever practice this lesson already has.
        console.error("[practice] generation failed; falling back to stored questions", err);
        return [] as Awaited<ReturnType<typeof teacherAgent.generateLessonPractice>>;
      });

    if (questions.length === 0) {
      questions = await prisma.question.findMany({
        where: { lessonId, stage: "PRACTICE", excluded: false },
        orderBy: { order: "asc" },
        take: 5,
      });
    }

    // Only what the player needs. The answer key never leaves the server.
    return Response.json({
      // An empty list is a valid answer: the player says there is nothing more to practise
      // and offers to finish, rather than showing an error beside a button that never works.
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
