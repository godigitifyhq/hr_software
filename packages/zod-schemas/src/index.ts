import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    departmentId: z.string().optional().or(z.literal("")),
  })
  .refine(
    (values: { password: string; confirmPassword: string }) =>
      values.password === values.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    },
  );

export const appraisalItemSchema = z.object({
  id: z.string().optional(),
  selfScore: z.number().min(1).max(5),
  comment: z.string().optional(),
});

export const hodReviewSchema = z.object({
  hodScore: z.number().min(1).max(5),
  notes: z.string().optional(),
});

export const committeeReviewSchema = z.object({
  committeeScore: z.number().min(1).max(5),
  notes: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AppraisalItemInput = z.infer<typeof appraisalItemSchema>;
export type HodReviewInput = z.infer<typeof hodReviewSchema>;
export type CommitteeReviewInput = z.infer<typeof committeeReviewSchema>;

export * from "./appraisal";
export * from "./faculty-profile";
