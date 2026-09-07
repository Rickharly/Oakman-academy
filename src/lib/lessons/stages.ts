/**
 * Lesson stage state machine (spec §10, ARCHITECTURE §4).
 *
 * Stages: STARTER → LEARN → PRACTICE → CHECK → FEEDBACK → COMPLETE.
 * STARTER, PRACTICE and CHECK are "graded" stages backed by an `ActivityAttempt`;
 * the rest just advance `LessonAttempt.currentStage`.
 */
import type { LessonAttempt, LessonStage } from "@/generated/prisma/client";

/** Canonical stage order. */
export const STAGES: readonly LessonStage[] = [
  "STARTER",
  "LEARN",
  "PRACTICE",
  "CHECK",
  "FEEDBACK",
  "COMPLETE",
] as const;

/** Stages that create an `ActivityAttempt` and are graded via `submitStage`. */
export const gradedStages = ["STARTER", "PRACTICE", "CHECK"] as const;
export type GradedStage = (typeof gradedStages)[number];

export function isGradedStage(stage: LessonStage): stage is GradedStage {
  return (gradedStages as readonly LessonStage[]).includes(stage);
}

export function stageIndex(stage: LessonStage): number {
  return STAGES.indexOf(stage);
}

/** Next stage in the sequence, or null when `stage` is COMPLETE (the terminal stage). */
export function nextStage(stage: LessonStage): LessonStage | null {
  const idx = stageIndex(stage);
  return idx < 0 || idx === STAGES.length - 1 ? null : STAGES[idx + 1];
}

/** Previous stage in the sequence, or null when `stage` is STARTER (the first stage). */
export function previousStage(stage: LessonStage): LessonStage | null {
  const idx = stageIndex(stage);
  return idx <= 0 ? null : STAGES[idx - 1];
}

/**
 * The `LessonAttempt` column stamped when a stage completes.
 * FEEDBACK has no dedicated column — it is considered complete once the
 * attempt has moved on to COMPLETE (see `service.ts` stage-status derivation).
 */
export function stageTimestampField(stage: LessonStage): keyof LessonAttempt | null {
  switch (stage) {
    case "STARTER":
      return "starterCompletedAt";
    case "LEARN":
      return "instructionCompletedAt";
    case "PRACTICE":
      return "practiceCompletedAt";
    case "CHECK":
      return "assessmentCompletedAt";
    case "FEEDBACK":
      return null;
    case "COMPLETE":
      return "completedAt";
    default:
      return null;
  }
}
