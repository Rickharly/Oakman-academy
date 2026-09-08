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

    const ids = Object.keys(body.answers);
    if (ids.length === 0) {
      return Response.json({ error: "Answer at least one question first." }, { status: 400 });
    }

    const [questions, lesson] = await Promise.all([
      prisma.question.findMany({ where: { id: { in: ids }, lessonId } }),
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

    const results = await Promise.all(
      questions.map((q) => gradeQuestion(q, body.answers[q.id], gradingContext)),
    );
    // Full marks only: a partially right answer is not "already knows this".
    const correct = results.filter((r, i) => r.score >= (questions[i].maxScore ?? 1)).length;

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
