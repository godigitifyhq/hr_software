import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    departmentId: z.string().optional()
});

export const appraisalSubmitSchema = z.object({
    cycleId: z.string(),
    items: z.array(z.object({ key: z.string(), points: z.number(), weight: z.number() })),
    remarks: z.string().optional()
});

export const appraisalUpdateSchema = z.object({
    items: z.array(
        z.object({
            id: z.string().optional(),
            key: z.string().min(1),
            points: z.number().int().min(0).max(4),
            weight: z.number().min(0),
            notes: z.string().optional()
        })
    ).min(1)
});

export type CreateUser = z.infer<typeof createUserSchema>;
export type AppraisalUpdate = z.infer<typeof appraisalUpdateSchema>;
