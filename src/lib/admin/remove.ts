/**
 * Permanently deletes a student's account: the `User` row, the `StudentProfile`, and every row
 * of their learning history.
 *
 * CLAUDE.md rule 2 says learning history is never deleted. This is the deliberate exception —
 * and it does not contradict the rule, because the rule protects a child's record from being
 * quietly rewritten or lost by the app (a bug, a re-sync, an AI grading pass), not from a parent
 * knowingly removing an account that they created. It is guarded the same way
 * `resetStudentProgress` is: the parent has to name the child and confirm (see the route), and
 * it refuses outright on anything that is not a `STUDENT` (see `requireParentForRemovalApi`).
 *
 * Every array relation `StudentProfile` owns in `prisma/schema.prisma` cascades from `User`
 * (`onDelete: Cascade`, verified against the schema and the generated migration SQL), so a
 * single `user.delete` removes the profile and all nineteen of those cascading child tables in
 * one statement. The one relation that is *not* a cascade is `Question.generatedForStudentId`
 * (`onDelete: SetNull`): AI-authored practice questions written for this child specifically are
 * not curriculum in the ordinary sense (CLAUDE.md rule 1's own exception names "AI-generated
 * Question rows" as something app code may touch), but they are not modelled as owned by
 * `StudentProfile` the way the other nineteen tables are, so the foreign key just detaches
 * instead of cascading. We capture their ids before the delete (the FK would otherwise be
 * nulled and unrecoverable) and remove them explicitly afterwards, mirroring what
 * `resetStudentProgress` already does for the same table.
 */
import { prisma } from "@/lib/db";

/**
 * Whether a student profile has any learning record at all.
 *
 * Used by `requireParentForRemovalApi` (src/lib/auth/api.ts) to decide whether an *unlinked*
 * profile is safe to remove: a profile no parent has ever claimed is only harmless to delete
 * when nothing has actually happened on it yet. The table list is exactly `resetStudentProgress`'s
 * own idea of "the child's record" (src/lib/admin/reset.ts) — everything that function wipes,
 * i.e. history, as opposed to `StudentEnrolment`/`StudentSchedule`, which are account *settings*
 * created alongside the profile and not evidence of use (reset.ts keeps those for the same
 * reason: "their account, PIN and timetable stay"). `ActivityAttempt` has no `studentId` column
 * of its own — it hangs off `LessonAttempt`, so a non-empty `lessonAttempt`/`questionAttempt`
 * count already implies one exists and there is nothing extra to check there.
 * `UnderstandingGap` is included even though `reset.ts` does not clear it: it is still a
 * recorded observation about the child, so its presence alone should block the orphan path.
 */
export async function studentHasLearningRecord(studentProfileId: string): Promise<boolean> {
  const counts = await Promise.all([
    prisma.lessonAttempt.count({ where: { studentId: studentProfileId } }),
    prisma.questionAttempt.count({ where: { studentId: studentProfileId } }),
    prisma.dailyAssignment.count({ where: { studentId: studentProfileId } }),
    prisma.studentLessonProgress.count({ where: { studentId: studentProfileId } }),
    prisma.readingEntry.count({ where: { studentId: studentProfileId } }),
    prisma.aiConversation.count({ where: { studentId: studentProfileId } }),
    prisma.masteryRecord.count({ where: { studentId: studentProfileId } }),
    prisma.reviewItem.count({ where: { studentId: studentProfileId } }),
    prisma.aiLearningObservation.count({ where: { studentId: studentProfileId } }),
    prisma.teacherFeedback.count({ where: { studentId: studentProfileId } }),
    prisma.parentOverride.count({ where: { studentId: studentProfileId } }),
    prisma.dailySummary.count({ where: { studentId: studentProfileId } }),
    prisma.report.count({ where: { studentId: studentProfileId } }),
    prisma.schoolDay.count({ where: { studentId: studentProfileId } }),
    prisma.focusEvent.count({ where: { studentId: studentProfileId } }),
    prisma.activityLog.count({ where: { studentId: studentProfileId } }),
    prisma.understandingGap.count({ where: { studentId: studentProfileId } }),
  ]);
  return counts.some((count) => count > 0);
}

export type RemovalSummary = {
  displayName: string;
  enrolments: number;
  schedules: number;
  assignments: number;
  lessonAttempts: number;
  questionAttempts: number;
  progress: number;
  masteryRecords: number;
  reviewItems: number;
  conversations: number;
  observations: number;
  feedback: number;
  overrides: number;
  dailySummaries: number;
  readingEntries: number;
  schoolDays: number;
  focusEvents: number;
  reports: number;
  activityLogs: number;
  understandingGaps: number;
  generatedQuestions: number;
};

export async function removeStudentAccount(studentProfileId: string): Promise<RemovalSummary> {
  return prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUniqueOrThrow({
      where: { id: studentProfileId },
      include: { user: true },
    });

    // Captured before the delete: once the student is gone the FK below is SET NULL, so this
    // is the only moment we can still tell which questions were generated for this child.
    const generatedQuestions = await tx.question.findMany({
      where: { generatedForStudentId: studentProfileId, source: "AI_GENERATED" },
      select: { id: true },
    });

    // Every count here is gathered before the delete so the parent sees exactly what they gave
    // up — a delete that returned nothing would be trusting them to remember.
    const [
      enrolments,
      schedules,
      assignments,
      lessonAttempts,
      questionAttempts,
      progress,
      masteryRecords,
      reviewItems,
      conversations,
      observations,
      feedback,
      overrides,
      dailySummaries,
      readingEntries,
      schoolDays,
      focusEvents,
      reports,
      activityLogs,
      understandingGaps,
    ] = await Promise.all([
      tx.studentEnrolment.count({ where: { studentId: studentProfileId } }),
      tx.studentSchedule.count({ where: { studentId: studentProfileId } }),
      tx.dailyAssignment.count({ where: { studentId: studentProfileId } }),
      tx.lessonAttempt.count({ where: { studentId: studentProfileId } }),
      tx.questionAttempt.count({ where: { studentId: studentProfileId } }),
      tx.studentLessonProgress.count({ where: { studentId: studentProfileId } }),
      tx.masteryRecord.count({ where: { studentId: studentProfileId } }),
      tx.reviewItem.count({ where: { studentId: studentProfileId } }),
      tx.aiConversation.count({ where: { studentId: studentProfileId } }),
      tx.aiLearningObservation.count({ where: { studentId: studentProfileId } }),
      tx.teacherFeedback.count({ where: { studentId: studentProfileId } }),
      tx.parentOverride.count({ where: { studentId: studentProfileId } }),
      tx.dailySummary.count({ where: { studentId: studentProfileId } }),
      tx.readingEntry.count({ where: { studentId: studentProfileId } }),
      tx.schoolDay.count({ where: { studentId: studentProfileId } }),
      tx.focusEvent.count({ where: { studentId: studentProfileId } }),
      tx.report.count({ where: { studentId: studentProfileId } }),
      tx.activityLog.count({ where: { studentId: studentProfileId } }),
      tx.understandingGap.count({ where: { studentId: studentProfileId } }),
    ]);

    // Deleting the User row cascades through StudentProfile and every table counted above.
    await tx.user.delete({ where: { id: student.userId } });

    // Not covered by the cascade (see module doc): the child's QuestionAttempts are already
    // gone via the cascade above, so nothing still references these — safe to remove now.
    if (generatedQuestions.length > 0) {
      await tx.question.deleteMany({ where: { id: { in: generatedQuestions.map((q) => q.id) } } });
    }

    return {
      displayName: student.user.displayName,
      enrolments,
      schedules,
      assignments,
      lessonAttempts,
      questionAttempts,
      progress,
      masteryRecords,
      reviewItems,
      conversations,
      observations,
      feedback,
      overrides,
      dailySummaries,
      readingEntries,
      schoolDays,
      focusEvents,
      reports,
      activityLogs,
      understandingGaps,
      generatedQuestions: generatedQuestions.length,
    };
  });
}
