-- AlterEnum
ALTER TYPE "ExamKind" ADD VALUE 'PLACEMENT';

-- AlterTable
ALTER TABLE "ExamQuestion" ADD COLUMN     "band" INTEGER;
