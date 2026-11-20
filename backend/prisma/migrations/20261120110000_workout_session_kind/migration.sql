-- A Daily session (the exercises of the Daily phase, done in pieces over the day) runs next to the
-- regular training session instead of replacing it.
CREATE TYPE "WorkoutSessionKind" AS ENUM ('TRAINING', 'DAILY');

ALTER TABLE "WorkoutSession" ADD COLUMN "kind" "WorkoutSessionKind" NOT NULL DEFAULT 'TRAINING';
