import { z } from "zod";

const numericString = z.coerce.number().finite();

export const facultyProfileSchema = z.object({
  fatherName: z.string().trim().min(1, "Father's name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  currentSalary: numericString.min(0, "Current salary is required"),
  lastIncrementDate: z.string().min(1, "Last increment date is required"),
  pan: z.string().trim().min(1, "PAN is required"),
  aadhar: z.string().trim().min(1, "Aadhaar is required"),
  tenthMarks: numericString.min(0, "10th marks are required"),
  twelfthMarks: numericString.min(0, "12th marks are required"),
  qualification: z.string().trim().min(1, "Qualification is required"),
  graduation: z.string().trim().min(1, "Graduation is required"),
  postGraduation: z.string().trim().optional().nullable(),
  phdDegree: z.string().trim().optional().nullable(),
  totalExperience: numericString.min(0, "Total experience is required"),
  departmentId: z.string().uuid("Department is required"),
});

export type FacultyProfileInput = z.infer<typeof facultyProfileSchema>;
