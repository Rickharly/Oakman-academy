-- AlterTable
ALTER TABLE "ReadingText" ADD COLUMN     "bookId" TEXT,
ADD COLUMN     "chapterNumber" INTEGER;

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorDeathYear" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'gutenberg',
    "sourceRef" TEXT,
    "sourceUrl" TEXT,
    "yearGroup" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'stretching',
    "contentNotes" TEXT,
    "whyThisBook" TEXT,
    "chapterCount" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");

-- CreateIndex
CREATE INDEX "Book_yearGroup_active_idx" ON "Book"("yearGroup", "active");

-- CreateIndex
CREATE INDEX "ReadingText_bookId_chapterNumber_idx" ON "ReadingText"("bookId", "chapterNumber");

-- AddForeignKey
ALTER TABLE "ReadingText" ADD CONSTRAINT "ReadingText_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
