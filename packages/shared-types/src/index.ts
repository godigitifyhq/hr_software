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

export interface FacultyAppraisalOption {
  value: string;
  label: string;
  points: number;
}

export interface FacultyAppraisalCriterion {
  key: string;
  heading: string;
  options: FacultyAppraisalOption[];
}

export interface FacultyIncrementBracket {
  min: number;
  max?: number;
  incrementPercent: number;
}

export interface FacultyAppraisalPolicy {
  criteria: FacultyAppraisalCriterion[];
  maxPoints: number;
  incrementBrackets: FacultyIncrementBracket[];
}

export interface FacultyEvidenceUpload {
  criterionKey: string;
  fileName: string;
  mime: string;
  size: number;
  url: string;
}

export interface FacultyAppraisalRequestItemPayload {
  criterionKey: string;
  selectedValue: string;
  evidence?: FacultyEvidenceUpload | null;
}

export interface FacultyAppraisalRequestPayload {
  items: FacultyAppraisalRequestItemPayload[];
}

export interface FacultyAppraisalRequestStatus {
  hasRequest: boolean;
  appraisalId?: string;
  status?: AppraisalStatus;
  submittedAt?: string | null;
  totalPoints?: number | null;
  incrementPercent?: number | null;
}
