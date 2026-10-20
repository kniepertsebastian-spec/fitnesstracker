-- Manually added plan exercises used to get `order` = (highest order of the same split day) + 1,
-- so every day restarted at 0. The sequence of the split days is the order in which their first
-- entry appears when sorting by `order` (planWeekStatus.groupByDayLabel) — with equal values
-- across days that is up to the database, and "today's workout" could be the wrong day.
--
-- Renumber only plans where that happens (the same `order` on entries of different days):
-- days in the order of their first-created entry, entries inside a day in their current order.
-- Plans with unique orders (AI generated, or already consistent) are left untouched.
WITH ambiguous AS (
  SELECT DISTINCT "userId", "phase"
  FROM "PlanExercise"
  GROUP BY "userId", "phase", "order"
  HAVING COUNT(DISTINCT COALESCE("dayLabel", '')) > 1
),
day_rank AS (
  SELECT p."userId", p."phase", COALESCE(p."dayLabel", '') AS day, MIN(p."createdAt") AS first_created
  FROM "PlanExercise" p
  JOIN ambiguous a ON a."userId" = p."userId" AND a."phase" = p."phase"
  GROUP BY p."userId", p."phase", COALESCE(p."dayLabel", '')
),
renumbered AS (
  SELECT
    p."id",
    ROW_NUMBER() OVER (
      PARTITION BY p."userId", p."phase"
      ORDER BY d.first_created, d.day, p."order", p."createdAt", p."id"
    ) - 1 AS new_order
  FROM "PlanExercise" p
  JOIN day_rank d
    ON d."userId" = p."userId" AND d."phase" = p."phase" AND d.day = COALESCE(p."dayLabel", '')
)
UPDATE "PlanExercise" p
SET "order" = r.new_order
FROM renumbered r
WHERE p."id" = r."id";
