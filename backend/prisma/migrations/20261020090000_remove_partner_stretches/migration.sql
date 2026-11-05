-- Partner stretches (free-exercise-db instructions like "Have your partner hold your feet") can't
-- be done alone. New routines filter them out (stretchSelection.isPartnerStretch); this drops the
-- ones already saved in AI-generated stretch plans. Same text rule as the TypeScript filter.
DELETE FROM "StretchPlanItem"
WHERE "exerciseId" IN (
  SELECT "id" FROM "Exercise"
  WHERE lower("category") = 'stretching'
    AND ("name" ~* '\mpartner' OR coalesce("description", '') ~* '\mpartner')
);
