-- A school marks the quiz and moves on. A tutor does not.
--
-- `UnderstandingGap` is one thing a child did not understand, and the tutoring that followed:
-- which strategies have been tried, what they said when asked to explain it back, and whether
-- they have actually got there yet. A gap stays OPEN until they can both answer questions on it
-- and put it in their own words, so "she did the lesson" and "she understood it" stop being the
-- same claim.

CREATE TYPE "TeachingStrategy" AS ENUM ('SIMPLER', 'ANALOGY', 'WORKED_EXAMPLE', 'ROLE_PLAY', 'BUILD_UP');
CREATE TYPE "GapStatus" AS ENUM ('OPEN', 'UNDERSTOOD', 'PARKED');

CREATE TABLE "UnderstandingGap" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lessonAttemptId" TEXT,
    "concept" TEXT NOT NULL,
    "misunderstanding" TEXT NOT NULL,
    "status" "GapStatus" NOT NULL DEFAULT 'OPEN',
    "round" INTEGER NOT NULL DEFAULT 0,
    "strategiesTried" JSONB NOT NULL DEFAULT '[]',
    "lastExplanation" JSONB,
    "lastExplainBack" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnderstandingGap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UnderstandingGap_studentId_status_idx" ON "UnderstandingGap"("studentId", "status");
CREATE INDEX "UnderstandingGap_lessonAttemptId_idx" ON "UnderstandingGap"("lessonAttemptId");

ALTER TABLE "UnderstandingGap" ADD CONSTRAINT "UnderstandingGap_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnderstandingGap" ADD CONSTRAINT "UnderstandingGap_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UnderstandingGap" ADD CONSTRAINT "UnderstandingGap_lessonAttemptId_fkey"
  FOREIGN KEY ("lessonAttemptId") REFERENCES "LessonAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
