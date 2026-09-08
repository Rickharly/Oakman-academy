-- Two requests arriving together (a refresh, two tabs, a prefetch) could each find the day
-- unplanned and each plan it, giving a child two of every lesson. Planning is deterministic,
-- so both runs choose the same lessons — which means the database can settle it.

-- 1. Clean up any duplicates already created, keeping the earliest row of each set.
DELETE FROM "DailyAssignment" a
USING "DailyAssignment" b
WHERE a."studentId" = b."studentId"
  AND a."date" = b."date"
  AND a."kind" = 'LESSON'
  AND b."kind" = 'LESSON'
  AND a."lessonId" IS NOT NULL
  AND a."lessonId" = b."lessonId"
  AND a."status" <> 'MOVED'
  AND b."status" <> 'MOVED'
  AND a."createdAt" > b."createdAt";

DELETE FROM "DailyAssignment" a
USING "DailyAssignment" b
WHERE a."studentId" = b."studentId"
  AND a."date" = b."date"
  AND a."kind" = 'READING'
  AND b."kind" = 'READING'
  AND a."status" <> 'MOVED'
  AND b."status" <> 'MOVED'
  AND a."createdAt" > b."createdAt";

DELETE FROM "DailyAssignment" a
USING "DailyAssignment" b
WHERE a."studentId" = b."studentId"
  AND a."date" = b."date"
  AND a."kind" = 'REVIEW'
  AND b."kind" = 'REVIEW'
  AND a."reviewItemId" IS NOT NULL
  AND a."reviewItemId" = b."reviewItemId"
  AND a."status" <> 'MOVED'
  AND b."status" <> 'MOVED'
  AND a."createdAt" > b."createdAt";

-- 2. Make it impossible to do again. Partial indexes so MOVED rows (the record of a lesson
--    shifted to another day) stay allowed, and so a parent-set CUSTOM assignment is unaffected.
CREATE UNIQUE INDEX "DailyAssignment_one_lesson_per_day"
  ON "DailyAssignment" ("studentId", "date", "lessonId")
  WHERE "kind" = 'LESSON' AND "status" <> 'MOVED';

CREATE UNIQUE INDEX "DailyAssignment_one_reading_per_day"
  ON "DailyAssignment" ("studentId", "date")
  WHERE "kind" = 'READING' AND "status" <> 'MOVED';

CREATE UNIQUE INDEX "DailyAssignment_one_review_per_day"
  ON "DailyAssignment" ("studentId", "date", "reviewItemId")
  WHERE "kind" = 'REVIEW' AND "status" <> 'MOVED';
