/**
 * Wipes a child's learning history so a test run can start from nothing.
 *
 * This is the one deliberate exception to "never delete learning history" (CLAUDE.md rule 2,
 * ARCHITECTURE §1). That rule exists so an app, a bug, or an AI never quietly loses a child's
 * work — not to stop a parent clearing out their own test data. So it is here, but only here:
 * a parent has to ask for it, name the child, and confirm.
 *
 * Curriculum, books and reading passages are untouched — those are reference data, and
 * re-importing them costs API quota.
 */
import { prisma } from "@/lib/db";

export type ResetSummary = {
  assignments: number;
  attempts: number;
  progress: number;
  readingEntries: number;
  conversations: number;
  schoolDays: number;
  reports: number;
};

export async function resetStudentProgress(studentId: string): Promise<ResetSummary> {
  const student = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    include: { user: true },
  });

  // Ordered so rows are gone before whatever points at them. Cascades cover the children of
  // LessonAttempt (activity attempts, question attempts) and of the conversations.
  const [
    readingEntries,
    conversations,
    attempts,
    assignments,
    progress,
    mastery,
    reviews,
    observations,
    feedback,
    overrides,
    summaries,
    reports,
    schoolDays,
    focusEvents,
    activity,
  ] = await prisma.$transaction([
    prisma.readingEntry.deleteMany({ where: { studentId } }),
    prisma.aiConversation.deleteMany({ where: { studentId } }),
    prisma.lessonAttempt.deleteMany({ where: { studentId } }),
    prisma.dailyAssignment.deleteMany({ where: { studentId } }),
    prisma.studentLessonProgress.deleteMany({ where: { studentId } }),
    prisma.masteryRecord.deleteMany({ where: { studentId } }),
    prisma.reviewItem.deleteMany({ where: { studentId } }),
    prisma.aiLearningObservation.deleteMany({ where: { studentId } }),
    prisma.teacherFeedback.deleteMany({ where: { studentId } }),
    prisma.parentOverride.deleteMany({ where: { studentId } }),
    prisma.dailySummary.deleteMany({ where: { studentId } }),
    prisma.report.deleteMany({ where: { studentId } }),
    prisma.schoolDay.deleteMany({ where: { studentId } }),
    prisma.focusEvent.deleteMany({ where: { studentId } }),
    prisma.activityLog.deleteMany({ where: { studentId } }),
  ]);

  // Questions the teacher wrote for this child specifically are theirs, not curriculum.
  await prisma.question.deleteMany({
    where: { generatedForStudentId: studentId, source: "AI_GENERATED" },
  });

  // Back to a first login: the welcome and its confetti again.
  const preferences = { ...((student.preferences ?? {}) as Record<string, unknown>) };
  delete preferences.welcomeSeenAt;
  await prisma.studentProfile.update({
    where: { id: studentId },
    data: { preferences: preferences as never },
  });

  void mastery;
  void reviews;
  void observations;
  void feedback;
  void overrides;
  void summaries;
  void focusEvents;
  void activity;

  return {
    assignments: assignments.count,
    attempts: attempts.count,
    progress: progress.count,
    readingEntries: readingEntries.count,
    conversations: conversations.count,
    schoolDays: schoolDays.count,
    reports: reports.count,
  };
}
