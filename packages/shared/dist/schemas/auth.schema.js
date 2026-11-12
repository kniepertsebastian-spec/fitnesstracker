import { z } from "zod";
export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    // Forms (e.g. an untouched HTML input) submit "" rather than omitting the field entirely —
    // treat that the same as "not provided" instead of failing min(1) validation.
    displayName: z.preprocess((val) => (val === "" ? undefined : val), z.string().min(1).max(80).optional()),
    setupToken: z.string().min(1),
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export const userDtoSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
});
// Real name for the activity report. Empty string clears it.
const nameField = z.preprocess((val) => (typeof val === "string" && val.trim() === "" ? null : val), z.string().trim().min(1).max(80).nullable());
export const updateNameSchema = z.object({ firstName: nameField, lastName: nameField });
const newPasswordField = z.string().min(8, "Password must be at least 8 characters").max(200);
// Signed in: needs the current password, so a stolen session alone can't take the account over.
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: newPasswordField,
});
// There is no mail delivery, so a forgotten password is reset with the operator's SETUP_TOKEN —
// the same secret that gates registration. Whoever hosts the app hands it out, nobody else can.
export const resetPasswordSchema = z.object({
    email: z.string().email(),
    setupToken: z.string().min(1),
    newPassword: newPasswordField,
});
// Deleting an account removes all of its data for good, so the password is asked again.
export const deleteAccountSchema = z.object({ password: z.string().min(1) });
//# sourceMappingURL=auth.schema.js.map