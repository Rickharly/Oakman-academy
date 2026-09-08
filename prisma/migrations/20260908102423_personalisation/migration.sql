-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "interests" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "teacherNotes" TEXT,
ADD COLUMN     "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voiceId" TEXT;
