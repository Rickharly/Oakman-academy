import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { gradeQuestion } from "@/lib/grading/grade";
import { prisma } from "@/lib/db";

/**
 * Marks the extra practice — the questions written after a lesson, either because it was
 * finished early or because something was got wrong.
 *
 * Deliberately separate from submitting the lesson's own practice stage. That stage grades
 * every practice question in the lesson, which would sweep in the ones already answered and
 * score them again; and this work is extra, not a re-run of the lesson. So it grades exactly
 * the questions that were on screen, records the attempts, and leaves the lesson's own stage
 * scores alone.
 */
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { lessonId } = await ctx.params;
    const body = z
      .object({ attemptId: z.string().min(1), answers: z.record(z.string(), z.unknown()) })
      .parse(await req.json());

    const ids = Object.keys(body.answers);
    if (ids.length === 0) {
      return Response.json({ error: "Answer at least one question first." }, { status: 400 });
    }

    const [attempt, questions, lesson] = await Promise.all([
      prisma.lessonAttempt.findFirst({
        where: { id: body.attemptId, studentId: user.studentProfile.id, lessonId },
      }),
      prisma.question.findMany({ where: { id: { in: ids }, lessonId } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }),
    ]);
    if (!attempt) return Response.json({ error: "Lesson not found" }, { status: 404 });

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

    // Extra practice is a round of its own, so its answers hang off their own activity rather
    // than being mixed into the lesson's practice stage.
    const latest = await prisma.activityAttempt.findFirst({
      where: { lessonAttemptId: attempt.id, stage: "PRACTICE" },
      orderBy: { attemptNumber: "desc" },
    });
    const activity = await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "PRACTICE",
        attemptNumber: (latest?.attemptNumber ?? 0) + 1,
        status: "GRADED",
        submittedAt: new Date(),
        gradedAt: new Date(),
      },
    });

    const results = await Promise.all(
      questions.map(async (question) => {
        const graded = await gradeQuestion(question, body.answers[question.id], gradingContext);
        const isCorrect = graded.score >= (question.maxScore ?? 1);

        // Extra practice is still learning history: it is recorded like any other answer.
        await prisma.questionAttempt
          .create({
            data: {
              activityAttemptId: activity.id,
              studentId: user.studentProfile.id,
              questionId: question.id,
              attemptNumber: 1,
              response: body.answers[question.id] as never,
              score: graded.score,
              maxScore: question.maxScore ?? 1,
              isCorrect,
              gradedBy: graded.gradedBy,
              feedback: graded.feedbackForStudent,
            },
          })
          .catch(() => undefined);

        return {
          questionId: question.id,
          isCorrect,
          score: graded.score,
          maxScore: question.maxScore ?? 1,
          feedback: graded.feedbackForStudent,
        };
      }),
    );

    const correct = results.filter((r) => r.isCorrect).length;
    const score = results.reduce((n, r) => n + r.score, 0);
    const maxScore = results.reduce((n, r) => n + r.maxScore, 0);
    await prisma.activityAttempt.update({
      where: { id: activity.id },
      data: { score, maxScore, percentage: maxScore > 0 ? (score / maxScore) * 100 : null },
    });

    return Response.json({ results, correct, total: results.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Unrecognised request" }, { status: 400 });
    }
    return jsonError(err);
  }
}
