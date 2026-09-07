-- CreateEnum
CREATE TYPE "FocusEventKind" AS ENUM ('TOILET', 'DRINK', 'CALLED_AWAY', 'OTHER', 'IDLE');

-- AlterTable
ALTER TABLE "LessonAttempt" ADD COLUMN     "activeSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "awaySeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "expectedStartAt" TIMESTAMP(3),
ADD COLUMN     "idleSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedLateSeconds" INTEGER;

-- CreateTable
CREATE TABLE "SchoolDay" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "plannedStartTime" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "startedLateSeconds" INTEGER,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptId" TEXT,
    "date" DATE NOT NULL,
    "kind" "FocusEventKind" NOT NULL,
    "note" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "seconds" INTEGER,

    CONSTRAINT "FocusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolDay_studentId_date_idx" ON "SchoolDay"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolDay_studentId_date_key" ON "SchoolDay"("studentId", "date");

-- CreateIndex
CREATE INDEX "FocusEvent_studentId_date_idx" ON "FocusEvent"("studentId", "date");

-- CreateIndex
CREATE INDEX "FocusEvent_attemptId_idx" ON "FocusEvent"("attemptId");

-- AddForeignKey
ALTER TABLE "SchoolDay" ADD CONSTRAINT "SchoolDay_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusEvent" ADD CONSTRAINT "FocusEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusEvent" ADD CONSTRAINT "FocusEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "LessonAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
