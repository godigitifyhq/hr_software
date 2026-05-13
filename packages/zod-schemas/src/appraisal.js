"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appraisalUpdateSchema = exports.appraisalSubmitSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
exports.createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    departmentId: zod_1.z.string().optional()
});
exports.appraisalSubmitSchema = zod_1.z.object({
    cycleId: zod_1.z.string(),
    items: zod_1.z.array(zod_1.z.object({ key: zod_1.z.string(), points: zod_1.z.number(), weight: zod_1.z.number() })),
    remarks: zod_1.z.string().optional()
});
exports.appraisalUpdateSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        key: zod_1.z.string().min(1),
        points: zod_1.z.number().int().min(0).max(4),
        weight: zod_1.z.number().min(0),
        notes: zod_1.z.string().optional()
    })).min(1)
});
