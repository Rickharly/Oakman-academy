-- A lesson that arrives without a video has, until now, shown a child its key points and then
-- a quiz. That is not a lesson. `explainer` holds the lesson taught in words, written once and
-- reused; `explainerAt` says when, so it can be regenerated if the lesson changes upstream.
ALTER TABLE "Lesson" ADD COLUMN "explainer" JSONB;
ALTER TABLE "Lesson" ADD COLUMN "explainerAt" TIMESTAMP(3);

-- Assets were fetched once, at import. A lesson imported while the provider's quota was spent
-- got no assets and was then skipped forever, which is why lessons had no video. Recording
-- when the asset list was last successfully read lets a later sync fill those in, without
-- re-asking about lessons that genuinely have none.
ALTER TABLE "Lesson" ADD COLUMN "assetsSyncedAt" TIMESTAMP(3);

-- Everything already imported has resources iff the asset call succeeded at the time. Mark the
-- ones that clearly worked so a backfill run spends its budget on the ones that did not.
UPDATE "Lesson" SET "assetsSyncedAt" = "syncedAt"
WHERE "syncedAt" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "LessonResource" r WHERE r."lessonId" = "Lesson".id);
