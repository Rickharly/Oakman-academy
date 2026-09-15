import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { gradeQuestion } from "@/lib/grading/grade";
import { advanceFromExtraPractice } from "@/lib/lessons/service";
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

    const answeredIds = Object.keys(body.answers);
    if (answeredIds.length === 0) {
      return Response.json({ error: "Answer at least one question first." }, { status: 400 });
    }

    const [attempt, lesson, worksheetQuestions, aiQuestions] = await Promise.all([
      prisma.lessonAttempt.findFirst({
        where: { id: body.attemptId, studentId: user.studentProfile.id, lessonId },
      }),
      prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }),
      // The lesson's own worksheet, made answerable: a fixed, shared set for the whole lesson
      // (buildWorksheetPractice persists it once and every child sees the same questions).
      prisma.question.findMany({ where: { lessonId, source: "OAK_WORKSHEET", stage: "PRACTICE", excluded: false } }),
      // This student's current round of AI-written practice: generated but not yet graded.
      // Once this submission grades them they drop out of "not yet attempted", so an older,
      // abandoned round never gets mistaken for the one just shown.
      prisma.question.findMany({
        where: {
          lessonId,
          source: "AI_GENERATED",
          stage: "PRACTICE",
          generatedForStudentId: user.studentProfile.id,
          excluded: false,
          attempts: { none: {} },
        },
      }),
    ]);
    if (!attempt) return Response.json({ error: "Lesson not found" }, { status: 404 });

    // Whichever pool the answered ids actually belong to is what was shown this round — grading
    // only `body.answers`' own keys made the total the count *answered*, not the count *shown*,
    // so 1 correct of 4 read as "every one right". A question in the shown set that never made
    // it into `body.answers` is one they left blank, and is graded as wrong, not skipped.
    const answeredSet = new Set(answeredIds);
    const shownPool = worksheetQuestions.some((q) => answeredSet.has(q.id)) ? worksheetQuestions : aiQuestions;
    const questions =
      shownPool.length > 0
        ? shownPool
        : await prisma.question.findMany({ where: { id: { in: answeredIds }, lessonId } });

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
        // A question in the shown set with nothing in `body.answers` is one they left blank —
        // graded as wrong, never handed to AI grading (which would otherwise be asked to mark
        // a non-answer, and could be generous about it).
        const hasAnswer = Object.prototype.hasOwnProperty.call(body.answers, question.id);
        const graded = hasAnswer
          ? await gradeQuestion(question, body.answers[question.id], gradingContext)
          : {
              score: 0,
              gradedBy: "DETERMINISTIC" as const,
              feedbackForStudent: "You didn't answer this one — have a go and see what you think.",
            };
        const isCorrect = graded.score >= (question.maxScore ?? 1);

        // Extra practice is still learning history: it is recorded like any other answer.
        await prisma.questionAttempt
          .create({
            data: {
              activityAttemptId: activity.id,
              studentId: user.studentProfile.id,
              questionId: question.id,
              attemptNumber: 1,
              response: (hasAnswer ? body.answers[question.id] : null) as never,
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

    // The work just graded is what moves the lesson on — not a second, separate request the
    // browser happens to make afterwards. A no-op when the attempt has already moved past
    // PRACTICE (the extra round taken from FEEDBACK/COMPLETE): see `advanceFromExtraPractice`.
    await advanceFromExtraPractice(attempt.id);

    return Response.json({ results, correct, total: results.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Unrecognised request" }, { status: 400 });
    }
    return jsonError(err);
  }
}
