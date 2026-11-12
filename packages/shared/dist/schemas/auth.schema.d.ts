import { z } from "zod";
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    setupToken: z.ZodString;
}, z.core.$strip>;
export type RegisterInput = z.infer<typeof registerSchema>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type LoginInput = z.infer<typeof loginSchema>;
export declare const userDtoSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    displayName: z.ZodNullable<z.ZodString>;
    firstName: z.ZodNullable<z.ZodString>;
    lastName: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type UserDto = z.infer<typeof userDtoSchema>;
export declare const updateNameSchema: z.ZodObject<{
    firstName: z.ZodPreprocess<z.ZodNullable<z.ZodString>, unknown>;
    lastName: z.ZodPreprocess<z.ZodNullable<z.ZodString>, unknown>;
}, z.core.$strip>;
export type UpdateNameInput = z.infer<typeof updateNameSchema>;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export declare const resetPasswordSchema: z.ZodObject<{
    email: z.ZodString;
    setupToken: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export declare const deleteAccountSchema: z.ZodObject<{
    password: z.ZodString;
}, z.core.$strip>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
