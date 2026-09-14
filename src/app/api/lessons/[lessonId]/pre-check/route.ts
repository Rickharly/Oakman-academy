import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { judgePreCheck } from "@/lib/lessons/pre-check";
import { gradeQuestion } from "@/lib/grading/grade";
import { prisma } from "@/lib/db";

/**
 * Marks a "do you already know this?" check.
 *
 * Graded on the server against the stored answer keys, like every other question in the app —
 * a client that could tell us it scored full marks could skip the whole curriculum.
 */
export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { lessonId } = await ctx.params;
    const body = z
      .object({ answers: z.record(z.string(), z.unknown()) })
      .parse(await req.json());

    if (Object.keys(body.answers).length === 0) {
      return Response.json({ error: "Answer at least one question first." }, { status: 400 });
    }

    // The pre-check is the lesson's own CHECK-stage questions (see pre-check.ts): the same set
    // `questionsByStage.CHECK` puts on screen, loaded fresh here rather than trusted from the
    // request. Grading only `body.answers`' keys made the total the count *answered*, not the
    // count *shown* — a child who answered 1 of 4 and left the rest blank scored "1 of 1".
    const [questions, lesson] = await Promise.all([
      prisma.question.findMany({
        where: {
          lessonId,
          stage: "CHECK",
          excluded: false,
          OR: [{ source: { not: "AI_GENERATED" } }, { generatedForStudentId: user.studentProfile.id }],
        },
        orderBy: { order: "asc" },
      }),
      prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }),
    ]);

    const gradingContext = {
      studentYearGroup: user.studentProfile.yearGroup,
      lesson: {
        title: lesson.title,
        keyLearningPoints: Array.isArray(lesson.keyLearningPoints)
          ? (lesson.keyLearningPoints as string[])
          : [],
        misconceptions: Array.isArray(lesson.misconceptions)
          ? (lesson.misconceptions as { misconception: string; response: string }[])
          : [],
      },
    };

    // Full marks only: a partially right answer is not "already knows this". A question with
    // nothing in `body.answers` is one they left blank — counted as wrong, and never handed to
    // AI grading (which would otherwise be asked to mark a non-answer and could be generous).
    const verdicts = await Promise.all(
      questions.map(async (q) => {
        if (!Object.prototype.hasOwnProperty.call(body.answers, q.id)) return false;
        const graded = await gradeQuestion(q, body.answers[q.id], gradingContext);
        return graded.score >= (q.maxScore ?? 1);
      }),
    );
    const correct = verdicts.filter(Boolean).length;

    const outcome = await judgePreCheck({
      studentId: user.studentProfile.id,
      lessonId,
      correct,
      total: questions.length,
    });

    return Response.json(outcome);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Unrecognised request" }, { status: 400 });
    }
    return jsonError(err);
  }
}
