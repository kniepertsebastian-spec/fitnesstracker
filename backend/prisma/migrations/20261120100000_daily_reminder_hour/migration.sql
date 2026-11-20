-- AlterTable: the local hour (0-23) from which the daily reminder may go out; was a fixed 20.
ALTER TABLE "User" ADD COLUMN "dailyReminderHour" INTEGER NOT NULL DEFAULT 20;
