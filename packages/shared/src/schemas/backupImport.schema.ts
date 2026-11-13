import { z } from "zod";

// What `GET /export/backup.json` writes, read back for `POST /import/backup.json`. Deliberately
// loose: every section is optional and only the fields the import needs are named, so a backup
// from an older version (missing sections or fields) still restores what it has. The service
// validates the values themselves (ranges, enums) per row and skips rows that do not fit instead
// of refusing the whole file.
const looseRows = <T extends z.ZodTypeAny>(row: T) => z.array(row).optional();

export const backupFileSchema = z.object({
  exportedAt: z.string().optional(),
  account: z.object({ email: z.string().optional(), displayName: z.string().nullable().optional() }).partial().optional(),
  settings: z
    .object({
      remindPhaseChange: z.boolean().optional(),
      remindSupplements: z.boolean().optional(),
      remindProgressPhoto: z.boolean().optional(),
    })
    .optional(),
  profile: z.record(z.string(), z.unknown()).nullable().optional(),
  trainingPlan: z.record(z.string(), z.unknown()).nullable().optional(),
  planExercises: looseRows(z.record(z.string(), z.unknown())),
  workoutLogs: looseRows(z.record(z.string(), z.unknown())),
  goals: looseRows(z.record(z.string(), z.unknown())),
  bodyCompositionEntries: looseRows(z.record(z.string(), z.unknown())),
  bodyFatCalibrations: looseRows(z.record(z.string(), z.unknown())),
  cardioLogs: looseRows(z.record(z.string(), z.unknown())),
  cardioPlanDays: looseRows(z.record(z.string(), z.unknown())),
  supplements: looseRows(z.record(z.string(), z.unknown())),
  progressPhotos: looseRows(z.record(z.string(), z.unknown())),
  dailyActivities: looseRows(z.record(z.string(), z.unknown())),
  cyclingSessions: looseRows(z.record(z.string(), z.unknown())),
});
export type BackupFile = z.infer<typeof backupFileSchema>;

export const BACKUP_SECTIONS = [
  "profile",
  "trainingPlan",
  "planExercises",
  "workoutLogs",
  "goals",
  "bodyCompositionEntries",
  "bodyFatCalibrations",
  "cardioLogs",
  "cardioPlanDays",
  "supplements",
  "dailyActivities",
  "cyclingSessions",
] as const;
export type BackupSection = (typeof BACKUP_SECTIONS)[number];

export const backupImportResultSchema = z.object({
  /** Rows written per section. */
  imported: z.record(z.string(), z.number().int()),
  /** Rows that were left out because they were incomplete or referred to an unknown exercise. */
  skipped: z.record(z.string(), z.number().int()),
  /** Custom exercises that had to be created because the backup's exercises do not exist here. */
  createdExercises: z.number().int(),
  /** Progress photos are listed in the backup but their image files are not part of it. */
  photosNotImported: z.number().int(),
});
export type BackupImportResult = z.infer<typeof backupImportResultSchema>;
