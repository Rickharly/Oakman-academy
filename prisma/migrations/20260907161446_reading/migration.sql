-- CreateEnum
CREATE TYPE "ReadingEntryKind" AS ENUM ('RESPONSE', 'ESSAY');

-- AlterEnum
ALTER TYPE "AssignmentKind" ADD VALUE 'READING';

-- AlterTable
ALTER TABLE "DailyAssignment" ADD COLUMN     "readingTextId" TEXT;

-- CreateTable
CREATE TABLE "ReadingText" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'Oakman Academy',
    "yearGroup" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "genre" TEXT NOT NULL DEFAULT 'fiction',
    "body" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 20,
    "prompts" JSONB NOT NULL DEFAULT '[]',
    "essayPrompt" TEXT,
    "vocabulary" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "readingTextId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "kind" "ReadingEntryKind" NOT NULL DEFAULT 'RESPONSE',
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedback" TEXT,
    "reasoning" TEXT,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "nextSteps" JSONB NOT NULL DEFAULT '[]',
    "gradedAt" TIMESTAMP(3),
    "model" TEXT,

    CONSTRAINT "ReadingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadingText_slug_key" ON "ReadingText"("slug");

-- CreateIndex
CREATE INDEX "ReadingText_yearGroup_order_idx" ON "ReadingText"("yearGroup", "order");

-- CreateIndex
CREATE INDEX "ReadingEntry_studentId_submittedAt_idx" ON "ReadingEntry"("studentId", "submittedAt");

-- AddForeignKey
ALTER TABLE "DailyAssignment" ADD CONSTRAINT "DailyAssignment_readingTextId_fkey" FOREIGN KEY ("readingTextId") REFERENCES "ReadingText"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEntry" ADD CONSTRAINT "ReadingEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEntry" ADD CONSTRAINT "ReadingEntry_readingTextId_fkey" FOREIGN KEY ("readingTextId") REFERENCES "ReadingText"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEntry" ADD CONSTRAINT "ReadingEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "DailyAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
