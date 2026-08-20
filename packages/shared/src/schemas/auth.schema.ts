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
});
export type UserDto = z.infer<typeof userDtoSchema>;
