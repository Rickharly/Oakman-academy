import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getAttemptView, startOrResumeAttempt } from "@/lib/lessons/service";
import { runReviewAssignment } from "@/lib/progress/review";
import {
  LessonPlayer,
  type LessonPlayerActivity,
  type LessonPlayerQuestion,
} from "@/components/student/LessonPlayer";
import { parseExplainer } from "@/lib/lessons/explainer";
import { plainMaths, plainMathsDeep } from "@/lib/text/maths";
import { ensureLessonAssets, type EnsureAssetsOutcome } from "@/lib/curriculum/sync";
import type { VideoUnavailableReason } from "@/lib/curriculum/video-status";

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
// The questions themselves are made readable in `getAttemptView`, so every consumer gets the
// same text — this page only has to do the lesson's own words.

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

  /**
   * The video, fetched for this lesson if nobody has fetched it yet — or if it was fetched once
   * and came back with no video, retried (see `ensureLessonAssets`).
   *
   * Lessons are imported in batches against a rationed quota, and their assets are left for a
   * later bulk run to collect. When that run has not reached this lesson, there is no video row
   * at all — which looks exactly like a broken player and is not. One provider request, for the
   * lesson a child is opening right now, is the cheapest and most useful request we can make.
   *
   * Bounded, generously: a real provider call is a network round trip plus Oak's own work, and
   * four seconds was cutting it off before a slow-but-working call ever finished — every open
   * paid the wait of the race losing and still got no video. Long enough to let a real call
   * land, short enough that a lesson never starts late waiting for it; the race still means a
   * genuinely stuck provider can never block the lesson opening.
   */
  const assetsOutcome = await Promise.race<EnsureAssetsOutcome | "timeout">([
    ensureLessonAssets(lessonId).then((r) => r.outcome).catch((): EnsureAssetsOutcome => "failed"),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 9000)),
  ]);

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

  /**
   * Why there is no video to watch, when there genuinely is none — not passed at all when a
   * VIDEO resource row exists, playable or not, because at that point the player can see the
   * row itself and work out the rest (a real address, or a placeholder one) without needing to
   * be told why by the server.
   */
  const hasVideoResource = lesson.resources.some((r) => r.type === "VIDEO");
  let videoUnavailableReason: VideoUnavailableReason | undefined;
  if (!hasVideoResource) {
    videoUnavailableReason =
      lesson.provider === "fixture"
        ? "placeholder_curriculum"
        : lesson.assetsSyncedAt
          ? "provider_had_none"
          : assetsOutcome === "failed"
            ? "fetch_failed"
            : "never_imported";
  }

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
        feedback: qa.feedback ? plainMaths(qa.feedback) : qa.feedback,
      })),
    }));

  return (
    <LessonPlayer
      attemptId={view.attempt.id}
      currentStage={view.attempt.currentStage}
      lesson={{
        id: lesson.id,
        title: plainMaths(lesson.title),
        // The provider writes these in LaTeX too — "Add $$\\frac{1}{2}$$ and $$\\frac{1}{4}$$" as a
        // learning point is the first thing a child reads when the lesson opens.
        keyLearningPoints: plainMathsDeep((lesson.keyLearningPoints as string[] | null) ?? []),
        keywords: plainMathsDeep(
          (lesson.keywords as { keyword: string; description: string }[] | null) ?? [],
        ),
        transcript: lesson.transcript ? plainMaths(lesson.transcript) : lesson.transcript,
        estimatedMinutes: lesson.estimatedMinutes,
        // The lesson taught in words. Already written for a lesson someone has reached before,
        // so it is on screen with the page rather than after a wait; null means the player
        // asks for it when the child opens the Learn step.
        explainer: parseExplainer(lesson.explainer),
        // Where this lesson lives on Oak's own site, for when we have no video file.
        oakUrl,
        // Why there is no video, when there is none — computed here because it depends on
        // things the player can never see (whether assets were ever fetched, and how that just
        // went). Undefined when a VIDEO resource row exists; the player works the rest out from
        // the row itself.
        videoUnavailableReason,
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
      voiceEnabled={user.studentProfile.voiceEnabled}
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
      feedbackSummary={
        view.attempt.feedbackSummary ? plainMaths(view.attempt.feedbackSummary) : view.attempt.feedbackSummary
      }
      masteryScore={view.attempt.masteryScore}
      nextLessonId={nextLessonId}
      lessonMinutes={user.studentProfile.lessonMinutes}
      breakMinutes={user.studentProfile.breakMinutes}
      elapsedSeconds={view.attempt.timeSpentSeconds}
      // So "I've already learned this" can take today's period off the board with it.
      assignmentId={assignmentId ?? view.attempt.assignmentId}
    />
  );
}
