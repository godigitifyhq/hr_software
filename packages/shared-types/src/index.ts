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
  | "FULLY_APPROVED"
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

export type FacultyDocumentModule = "faculty-profile" | "appraisal-evidence";

export type FacultyProfileDocumentFieldKey =
  | "profilePicture"
  | "panCard"
  | "aadhaarCard"
  | "tenthMarksheet"
  | "twelfthMarksheet"
  | "graduationDegree"
  | "postGraduationDegree"
  | "phdDegree";

export interface FacultyDocumentUploadConfig {
  fieldKey: FacultyProfileDocumentFieldKey;
  label: string;
  required: boolean;
  accept: string[];
  maxSizeBytes: number;
  helperText: string;
}

export interface FacultyDocumentSummary {
  id: UUID;
  module: FacultyDocumentModule | string;
  fieldKey: string;
  name: string;
  originalName: string;
  mime: string;
  size: number;
  driveId?: string | null;
  viewUrl?: string | null;
  directUrl?: string | null;
  folderId?: string | null;
  storageProvider?: string | null;
  uploadedAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const FACULTY_PROFILE_DOCUMENT_UPLOADS: FacultyDocumentUploadConfig[] = [
  {
    fieldKey: "profilePicture",
    label: "Profile Picture",
    required: true,
    accept: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 4 * 1024 * 1024,
    helperText: "JPEG, PNG, or WebP up to 4 MB.",
  },
  {
    fieldKey: "panCard",
    label: "PAN Card",
    required: true,
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxSizeBytes: 8 * 1024 * 1024,
    helperText: "Upload the PAN card as an image or PDF up to 8 MB.",
  },
  {
    fieldKey: "aadhaarCard",
    label: "Aadhaar Card",
    required: true,
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxSizeBytes: 8 * 1024 * 1024,
    helperText: "Upload the Aadhaar card as an image or PDF up to 8 MB.",
  },
  {
    fieldKey: "tenthMarksheet",
    label: "10th Marksheet",
    required: true,
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxSizeBytes: 10 * 1024 * 1024,
    helperText: "Upload the 10th marksheet as an image or PDF up to 10 MB.",
  },
  {
    fieldKey: "twelfthMarksheet",
    label: "12th Marksheet",
    required: true,
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxSizeBytes: 10 * 1024 * 1024,
    helperText: "Upload the 12th marksheet as an image or PDF up to 10 MB.",
  },
  {
    fieldKey: "graduationDegree",
    label: "Graduation Degree",
    required: true,
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxSizeBytes: 10 * 1024 * 1024,
    helperText:
      "Upload the graduation degree certificate as an image or PDF up to 10 MB.",
  },
  {
    fieldKey: "postGraduationDegree",
    label: "Post Graduation Degree",
    required: false,
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxSizeBytes: 10 * 1024 * 1024,
    helperText: "Optional. Upload the post-graduation degree certificate.",
  },
  {
    fieldKey: "phdDegree",
    label: "PhD Degree",
    required: false,
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxSizeBytes: 10 * 1024 * 1024,
    helperText: "Optional. Upload the PhD degree certificate.",
  },
];

export function getFacultyProfileDocumentConfig(
  fieldKey: FacultyProfileDocumentFieldKey,
) {
  return FACULTY_PROFILE_DOCUMENT_UPLOADS.find(
    (entry) => entry.fieldKey === fieldKey,
  );
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
  documents?: FacultyDocumentSummary[];
  isProfileComplete: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FacultyProfilePayload {
  fatherName: string;
  dob: string;
  dateOfJoining: string;
  currentSalary: number;
  lastIncrementDate?: string | null;
  tenthMarks: number;
  twelfthMarks: number;
  totalExperience: number;
  departmentId: UUID;
  pan?: string | null;
  aadhar?: string | null;
  qualification?: string | null;
  graduation?: string | null;
  postGraduation?: string | null;
  phdDegree?: string | null;
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
  viewUrl?: string | null;
  directUrl?: string | null;
  driveId?: string | null;
  module?: FacultyDocumentModule | string;
  fieldKey?: string;
}

export interface FacultyAppraisalRequestItemPayload {
  criterionKey: string;
  selectedValue: string;
  evidence?: FacultyEvidenceUpload[] | null;
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
