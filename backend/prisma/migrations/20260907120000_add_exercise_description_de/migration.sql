ALTER TABLE "Exercise" ADD COLUMN "descriptionDe" TEXT;

-- The original hand-written seed stored German in the legacy English columns. Normalize those
-- eight known rows so both language choices are useful on existing installations.
UPDATE "Exercise"
SET
  "nameDe" = "name",
  "descriptionDe" = "description",
  "name" = CASE "sourceId"
    WHEN 'bankdruecken' THEN 'Bench Press'
    WHEN 'kniebeuge' THEN 'Squat'
    WHEN 'kreuzheben' THEN 'Deadlift'
    WHEN 'schulterdruecken' THEN 'Overhead Press'
    WHEN 'klimmzug' THEN 'Pull-Up'
    WHEN 'latzug' THEN 'Lat Pulldown'
    WHEN 'rudern-vorgebeugt' THEN 'Bent-Over Row'
    WHEN 'beinpresse' THEN 'Leg Press'
    ELSE "name"
  END,
  "description" = CASE "sourceId"
    WHEN 'bankdruecken' THEN 'Barbell bench press on a flat bench.'
    WHEN 'kniebeuge' THEN 'Barbell squat with a hip-width stance.'
    WHEN 'kreuzheben' THEN 'Conventional barbell deadlift.'
    WHEN 'schulterdruecken' THEN 'Standing or seated barbell or dumbbell overhead press.'
    WHEN 'klimmzug' THEN 'Overhand-grip pull-up, pulling the body up through the full range of motion.'
    WHEN 'latzug' THEN 'Cable lat pulldown to the chest.'
    WHEN 'rudern-vorgebeugt' THEN 'Bent-over barbell row.'
    WHEN 'beinpresse' THEN 'Machine leg press.'
    ELSE "description"
  END
WHERE "source" = 'manual' AND "sourceId" IN (
  'bankdruecken', 'kniebeuge', 'kreuzheben', 'schulterdruecken',
  'klimmzug', 'latzug', 'rudern-vorgebeugt', 'beinpresse'
);
