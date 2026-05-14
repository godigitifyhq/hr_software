import fs from "fs";
import path from "path";
import { decryptSensitiveValue, encryptSensitiveValue } from "./security";
import {
  FACULTY_PROFILE_DOCUMENT_UPLOADS,
  type FacultyDocumentSummary,
} from "./facultyDocuments";

type UserProfileRecord = {
  id: string;
  firstName: string;
  lastName: string;
  departmentId: string | null;
  department: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  facultyProfile: {
    userId: string;
    fatherName: string | null;
    dob: Date | null;
    dateOfJoining: Date | null;
    currentSalary: number | null;
    lastIncrementDate: Date | null;
    panEncrypted: string | null;
    aadharEncrypted: string | null;
    tenthMarks: number | null;
    twelfthMarks: number | null;
    qualification: string | null;
    graduation: string | null;
    postGraduation: string | null;
    phdDegree: string | null;
    imageUrl: string | null;
    totalExperience: number | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  documents?: Array<{
    id: string;
    module: string;
    fieldKey: string;
    name: string;
    originalName: string;
    mime: string;
    size: number;
    driveId: string | null;
    viewUrl: string | null;
    directUrl: string | null;
    folderId: string | null;
    storageProvider: string | null;
    uploadedAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }>;
};

export const facultyUploadDir = path.join(
  process.cwd(),
  "uploads",
  "faculty-profile",
);

export function ensureFacultyUploadDir() {
  fs.mkdirSync(facultyUploadDir, { recursive: true });
}

function decryptOptional(value: string | null) {
  if (!value) {
    return null;
  }

  return decryptSensitiveValue(value);
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDocumentForField(
  documents: NonNullable<UserProfileRecord["documents"]> | undefined,
  fieldKey: string,
) {
  return Boolean(
    documents?.some(
      (document) =>
        document.deletedAt == null &&
        document.fieldKey === fieldKey &&
        document.module === "faculty-profile",
    ),
  );
}

function getDocumentForField(
  documents: NonNullable<UserProfileRecord["documents"]> | undefined,
  fieldKey: string,
) {
  return documents?.find(
    (document) =>
      document.deletedAt == null &&
      document.fieldKey === fieldKey &&
      document.module === "faculty-profile",
  );
}

export function isFacultyProfileComplete(user: UserProfileRecord): boolean {
  const profile = user.facultyProfile;
  const documents = user.documents ?? [];

  const requiredDocumentKeys = FACULTY_PROFILE_DOCUMENT_UPLOADS.filter(
    (document) => document.required,
  ).map((document) => document.fieldKey);

  return Boolean(
    hasText(user.firstName) &&
      hasText(user.lastName) &&
      hasText(profile?.fatherName) &&
      profile?.dob &&
      profile?.dateOfJoining &&
      user.departmentId &&
      typeof profile?.currentSalary === "number" &&
      profile?.lastIncrementDate &&
      typeof profile?.tenthMarks === "number" &&
      typeof profile?.twelfthMarks === "number" &&
      typeof profile?.totalExperience === "number" &&
      requiredDocumentKeys.every((fieldKey) =>
        hasDocumentForField(documents, fieldKey),
      ) &&
      hasDocumentForField(documents, "profilePicture"),
  );
}

export function serializeFacultyProfile(user: UserProfileRecord) {
  const profile = user.facultyProfile;
  const pan = decryptOptional(profile?.panEncrypted ?? null);
  const aadhar = decryptOptional(profile?.aadharEncrypted ?? null);
  const documents = (user.documents ?? [])
    .filter(
      (document) =>
        document.deletedAt == null && document.module === "faculty-profile",
    )
    .map((document) => ({
      id: document.id,
      module: document.module,
      fieldKey: document.fieldKey,
      name: document.name,
      originalName: document.originalName,
      mime: document.mime,
      size: document.size,
      driveId: document.driveId,
      viewUrl: document.viewUrl,
      directUrl: document.directUrl,
      folderId: document.folderId,
      storageProvider: document.storageProvider,
      uploadedAt: document.uploadedAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      deletedAt: document.deletedAt ? document.deletedAt.toISOString() : null,
    }));
  const profilePicture = getDocumentForField(user.documents, "profilePicture");

  return {
    userId: user.id,
    fatherName: profile?.fatherName ?? null,
    dob: profile?.dob?.toISOString() ?? null,
    dateOfJoining: profile?.dateOfJoining?.toISOString() ?? null,
    currentSalary: profile?.currentSalary ?? null,
    lastIncrementDate: profile?.lastIncrementDate?.toISOString() ?? null,
    pan,
    aadhar,
    tenthMarks: profile?.tenthMarks ?? null,
    twelfthMarks: profile?.twelfthMarks ?? null,
    qualification: profile?.qualification ?? null,
    graduation: profile?.graduation ?? null,
    postGraduation: profile?.postGraduation ?? null,
    phdDegree: profile?.phdDegree ?? null,
    imageUrl:
      profile?.imageUrl ??
      profilePicture?.directUrl ??
      profilePicture?.viewUrl ??
      null,
    totalExperience: profile?.totalExperience ?? null,
    departmentId: user.departmentId,
    department: user.department,
    documents,
    isProfileComplete: isFacultyProfileComplete(user),
    createdAt: profile?.createdAt.toISOString(),
    updatedAt: profile?.updatedAt.toISOString(),
  };
}

export function encryptFacultyIdentity(input: {
  pan?: string | null;
  aadhar?: string | null;
}) {
  const pan = input.pan?.trim();
  const aadhar = input.aadhar?.trim();

  return {
    panEncrypted: pan ? encryptSensitiveValue(pan) : null,
    aadharEncrypted: aadhar ? encryptSensitiveValue(aadhar) : null,
  };
}
