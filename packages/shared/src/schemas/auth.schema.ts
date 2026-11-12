import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // Forms (e.g. an untouched HTML input) submit "" rather than omitting the field entirely —
  // treat that the same as "not provided" instead of failing min(1) validation.
  displayName: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).max(80).optional(),
  ),
  setupToken: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const userDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  timeZone: z.string(),
});
export type UserDto = z.infer<typeof userDtoSchema>;

function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Sent by the browser (Intl.DateTimeFormat().resolvedOptions().timeZone) after login.
export const updateTimeZoneSchema = z.object({
  timeZone: z.string().min(1).max(64).refine(isIanaTimeZone, "Unbekannte Zeitzone"),
});
export type UpdateTimeZoneInput = z.infer<typeof updateTimeZoneSchema>;

// Real name for the activity report. Empty string clears it.
const nameField = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : val),
  z.string().trim().min(1).max(80).nullable(),
);
export const updateNameSchema = z.object({ firstName: nameField, lastName: nameField });
export type UpdateNameInput = z.infer<typeof updateNameSchema>;

const newPasswordField = z.string().min(8, "Password must be at least 8 characters").max(200);

// Signed in: needs the current password, so a stolen session alone can't take the account over.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: newPasswordField,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// There is no mail delivery, so a forgotten password is reset with the operator's RESET_TOKEN —
// a secret of its own, not the SETUP_TOKEN that is handed to everyone who may register.
export const resetPasswordSchema = z.object({
  email: z.string().email(),
  resetToken: z.string().min(1),
  newPassword: newPasswordField,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Deleting an account removes all of its data for good, so the password is asked again.
export const deleteAccountSchema = z.object({ password: z.string().min(1) });
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
