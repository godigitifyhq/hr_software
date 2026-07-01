import { z } from "zod";

const numericValue = z.coerce.number().finite();

export const facultyProfileSchema = z.object({
  fatherName: z.string().trim().min(1, "Father's name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  currentSalary: numericValue.min(0, "Current salary is required"),
  lastIncrementDate: z.string().optional().nullable(),
  pan: z.string().trim().optional().nullable(),
  aadhar: z.string().trim().optional().nullable(),
  tenthMarks: numericValue.min(0, "10th marks are required"),
  twelfthMarks: numericValue.min(0, "12th marks are required"),
  qualification: z.string().trim().optional().nullable(),
  graduation: z.string().trim().optional().nullable(),
  postGraduation: z.string().trim().optional().nullable(),
  otherPgDegree: z.string().trim().optional().nullable(),
  phdDegree: z.string().trim().optional().nullable(),
  totalExperience: numericValue.min(0, "Total experience is required"),
  departmentId: z.string().uuid("Department is required"),
  phone: z.string().trim().optional().nullable(),
  designation: z.string().trim().optional().nullable(),
  employeeCode: z.string().trim().optional().nullable(),
  collegeName: z.string().trim().optional().nullable(),
  profileRemarks: z.string().trim().optional().nullable(),
});

export const facultyAppraisalEvidenceSchema = z.object({
  criterionKey: z.string().min(1),
  fileName: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().positive(),
  url: z.string().min(1),
});

export const facultyAppraisalRequestSchema = z.object({
  items: z.array(
    z.object({
      criterionKey: z.string().min(1),
      selectedValue: z.string().min(1),
      evidence: z.array(facultyAppraisalEvidenceSchema).optional().nullable(),
      remarks: z.string().trim().optional().nullable(),
    }),
  ),
});
