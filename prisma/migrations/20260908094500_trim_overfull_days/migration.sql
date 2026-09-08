-- The earlier clean-up only caught days containing the SAME lesson twice. But two plans racing
-- pick different lessons the second time round — the first plan marks its choices as used, so
-- the second reaches for the next lesson in each subject. The result is a day with two
-- different maths lessons, two different English lessons, and so on: a doubled day that the
-- same-lesson rule does not see.
--
-- The rule that actually holds is the timetable itself: a day has exactly as many periods as
-- the child's timetable says. Anything past that, and not yet started, is surplus.

WITH ranked AS (
  SELECT
    a.id,
    a.status,
    row_number() OVER (
      PARTITION BY a."studentId", a."date"
      ORDER BY a."createdAt", a.id
    ) AS position,
    sp."lessonsPerDay" AS cap
  FROM "DailyAssignment" a
  JOIN "StudentProfile" sp ON sp.id = a."studentId"
  WHERE a."kind" = 'LESSON' AND a."status" <> 'MOVED'
)
DELETE FROM "DailyAssignment"
WHERE id IN (
  -- Only PLANNED rows are removed. A lesson already started or finished is a child's work and
  -- is never deleted, even if it makes the day long.
  SELECT id FROM ranked WHERE position > cap AND status = 'PLANNED'
);
