import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { canEmbed } from "@/lib/curriculum/embed";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getAttemptView, startOrResumeAttempt } from "@/lib/lessons/service";
import { runReviewAssignment } from "@/lib/progress/review";
import {
  LessonPlayer,
  type LessonPlayerActivity,
  type LessonPlayerQuestion,
} from "@/components/student/LessonPlayer";

type RawQuestion = {
  id: string;
  type: string;
  stage: string;
  prompt: string;
  promptImage: unknown;
  options: unknown;
  maxScore: number;
};

function mapQuestion(q: RawQuestion): LessonPlayerQuestion {
  return {
    id: q.id,
    type: q.type,
    stage: q.stage as "STARTER" | "PRACTICE" | "CHECK",
    prompt: q.prompt,
    promptImage: q.promptImage,
    options: q.options,
    maxScore: q.maxScore,
  };
}

/** Asks Oak whether their lesson pages may be framed by us. Never throws; false means link. */
async function resolveOakEmbedding(oakUrl: string | null): Promise<boolean> {
  if (!oakUrl) return false;
  if (process.env.OAK_EMBED_LESSONS === "off") return false;
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (!host) return false;
  return canEmbed(oakUrl, `${proto}://${host}`);
}

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ assignmentId?: string; kind?: string }>;
}) {
  const { lessonId } = await params;
  const { assignmentId, kind } = await searchParams;
  const user = await requireStudent();
  const studentId = user.studentProfile.id;

  const lessonExists = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lessonExists) notFound();

  // A REVIEW assignment re-runs the CHECK stage; anything else starts/resumes normally.
  const attempt =
    kind === "REVIEW" && assignmentId
      ? await runReviewAssignment(assignmentId, studentId)
      : await startOrResumeAttempt(studentId, lessonId, assignmentId);

  const view = await getAttemptView(attempt.id, studentId);
  const { lesson } = view;
  const subject = lesson.unit.programme.subject;

  // Next lesson: the next one in this unit by order, else the first lesson of the next unit.
  const siblingLessons = await prisma.lesson.findMany({
    where: { unitId: lesson.unitId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const idx = siblingLessons.findIndex((l) => l.id === lesson.id);
  let nextLessonId: string | null = idx >= 0 && idx < siblingLessons.length - 1 ? siblingLessons[idx + 1].id : null;
  if (!nextLessonId) {
    const nextUnit = await prisma.unit.findFirst({
      where: { programmeId: lesson.unit.programmeId, order: { gt: lesson.unit.order } },
      orderBy: { order: "asc" },
      include: { lessons: { orderBy: { order: "asc" }, take: 1 } },
    });
    nextLessonId = nextUnit?.lessons[0]?.id ?? null;
  }

  const oakUrl = lesson.canonicalUrl ?? lesson.providerUrl;
  const oakEmbeddable = await resolveOakEmbedding(oakUrl);

  const questionsByStage: Record<"STARTER" | "PRACTICE" | "CHECK", LessonPlayerQuestion[]> = {
    STARTER: view.questionsByStage.STARTER.map(mapQuestion),
    PRACTICE: view.questionsByStage.PRACTICE.map(mapQuestion),
    CHECK: view.questionsByStage.CHECK.map(mapQuestion),
  };

  const activities: LessonPlayerActivity[] = view.activities
    .filter((a) => a.stage === "STARTER" || a.stage === "PRACTICE" || a.stage === "CHECK")
    .map((a) => ({
      stage: a.stage as "STARTER" | "PRACTICE" | "CHECK",
      status: a.status,
      score: a.score,
      maxScore: a.maxScore,
      percentage: a.percentage,
      questionAttempts: a.questionAttempts.map((qa) => ({
        questionId: qa.questionId,
        attemptNumber: qa.attemptNumber,
        gradedBy: qa.gradedBy,
        isCorrect: qa.isCorrect,
        score: qa.score,
        maxScore: qa.maxScore,
        feedback: qa.feedback,
      })),
    }));

  return (
    <LessonPlayer
      attemptId={view.attempt.id}
      currentStage={view.attempt.currentStage}
      lesson={{
        id: lesson.id,
        title: lesson.title,
        keyLearningPoints: (lesson.keyLearningPoints as string[] | null) ?? [],
        keywords: (lesson.keywords as { keyword: string; description: string }[] | null) ?? [],
        transcript: lesson.transcript,
        estimatedMinutes: lesson.estimatedMinutes,
        // Where this lesson lives on Oak's own site, for when we have no video file.
        oakUrl,
        // Whether their site permits being shown inside ours. Decided by their own headers,
        // asked once per host and cached — a blank frame would be worse than a link.
        oakEmbeddable,
        resources: lesson.resources.map((r) => ({
          id: r.id,
          type: r.type,
          label: r.label,
          providerUrl: r.providerUrl,
          storedPath: r.storedPath,
        })),
      }}
      subjectTitle={subject.title}
      subjectSlug={subject.slug}
      unitTitle={lesson.unit.title}
      questionsByStage={questionsByStage}
      // Only for a lesson not yet begun: asking someone mid-lesson whether they need it makes
      // no sense, and a lesson they have already worked on is not one to skip.
      offerPreCheck={
        view.attempt.currentStage === "STARTER" &&
        // An activity row exists the moment the lesson is opened, so its presence proves
        // nothing. Having answered a question does.
        view.activities.every((a) => a.questionAttempts.length === 0 && a.status !== "GRADED")
      }
      activities={activities}
      drafts={view.drafts}
      worksheetFallback={
        view.worksheetFallback
          ? {
              id: view.worksheetFallback.id,
              type: view.worksheetFallback.type,
              label: view.worksheetFallback.label,
              providerUrl: view.worksheetFallback.providerUrl,
              storedPath: view.worksheetFallback.storedPath,
            }
          : null
      }
      feedbackSummary={view.attempt.feedbackSummary}
      masteryScore={view.attempt.masteryScore}
      nextLessonId={nextLessonId}
      lessonMinutes={user.studentProfile.lessonMinutes}
      breakMinutes={user.studentProfile.breakMinutes}
      elapsedSeconds={view.attempt.timeSpentSeconds}
    />
  );
}
