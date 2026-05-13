import { z } from 'zod';
export declare const createUserSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    departmentId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const appraisalSubmitSchema: z.ZodObject<{
    cycleId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        points: z.ZodNumber;
        weight: z.ZodNumber;
    }, z.core.$strip>>;
    remarks: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const appraisalUpdateSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        key: z.ZodString;
        points: z.ZodNumber;
        weight: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type AppraisalUpdate = z.infer<typeof appraisalUpdateSchema>;
