-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastDailyChallengeReminderSentOn" DATE,
ADD COLUMN     "lastWorkoutReminderSentOn" DATE,
ADD COLUMN     "remindAppUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "remindDailyChallenge" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "remindGoalAchievements" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "remindPersonalRecords" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "remindSyncErrors" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "remindWorkout" BOOLEAN NOT NULL DEFAULT true;
