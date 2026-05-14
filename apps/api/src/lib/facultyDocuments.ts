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
  id: string;
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
  uploadedAt: string;
  updatedAt: string;
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
