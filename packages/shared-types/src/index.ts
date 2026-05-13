/**
 * Shared TypeScript types used across services
 */

export type UUID = string;

export type AppraisalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "HOD_REVIEW"
  | "COMMITTEE_REVIEW"
  | "HR_FINALIZED"
  | "CLOSED";

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type RoleName =
  | "FACULTY"
  | "EMPLOYEE"
  | "HOD"
  | "COMMITTEE"
  | "HR"
  | "MANAGEMENT"
  | "SUPER_ADMIN";

export interface IUser {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  departmentId?: UUID;
}

export interface DepartmentSummary {
  id: UUID;
  name: string;
  code?: string | null;
}

export interface FacultyProfile {
  userId: UUID;
  fatherName: string | null;
  dob: string | null;
  dateOfJoining: string | null;
  currentSalary: number | null;
  lastIncrementDate: string | null;
  pan: string | null;
  aadhar: string | null;
  tenthMarks: number | null;
  twelfthMarks: number | null;
  qualification: string | null;
  graduation: string | null;
  postGraduation: string | null;
  phdDegree: string | null;
  imageUrl: string | null;
  totalExperience: number | null;
  departmentId: UUID | null;
  department: DepartmentSummary | null;
  isProfileComplete: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FacultyProfilePayload {
  fatherName: string;
  dob: string;
  dateOfJoining: string;
  currentSalary: number;
  lastIncrementDate: string;
  pan: string;
  aadhar: string;
  tenthMarks: number;
  twelfthMarks: number;
  qualification: string;
  graduation: string;
  postGraduation?: string | null;
  phdDegree?: string | null;
  totalExperience: number;
  departmentId: UUID;
}
