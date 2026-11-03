-- "Training vergessen zu beenden": prompt after 2h, auto-complete 30 min later if unanswered.
ALTER TABLE "WorkoutSession" ADD COLUMN "stopPromptSentAt" TIMESTAMP(3);
ALTER TABLE "WorkoutSession" ADD COLUMN "keepAliveAt" TIMESTAMP(3);
