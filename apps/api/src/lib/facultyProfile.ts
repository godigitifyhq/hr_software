import fs from "fs";
import path from "path";
import { decryptSensitiveValue, encryptSensitiveValue } from "./security";

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

export function isFacultyProfileComplete(user: UserProfileRecord): boolean {
  const profile = user.facultyProfile;
  const pan = decryptOptional(profile?.panEncrypted ?? null);
  const aadhar = decryptOptional(profile?.aadharEncrypted ?? null);

  return Boolean(
    hasText(user.firstName) &&
      hasText(user.lastName) &&
      hasText(profile?.fatherName) &&
      profile?.dob &&
      profile?.dateOfJoining &&
      user.departmentId &&
      typeof profile?.currentSalary === "number" &&
      profile?.lastIncrementDate &&
      hasText(pan) &&
      hasText(aadhar) &&
      typeof profile?.tenthMarks === "number" &&
      typeof profile?.twelfthMarks === "number" &&
      hasText(profile?.qualification) &&
      hasText(profile?.graduation) &&
      hasText(profile?.imageUrl) &&
      typeof profile?.totalExperience === "number",
  );
}

export function serializeFacultyProfile(user: UserProfileRecord) {
  const profile = user.facultyProfile;
  const pan = decryptOptional(profile?.panEncrypted ?? null);
  const aadhar = decryptOptional(profile?.aadharEncrypted ?? null);

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
    imageUrl: profile?.imageUrl ?? null,
    totalExperience: profile?.totalExperience ?? null,
    departmentId: user.departmentId,
    department: user.department,
    isProfileComplete: isFacultyProfileComplete(user),
    createdAt: profile?.createdAt.toISOString(),
    updatedAt: profile?.updatedAt.toISOString(),
  };
}

export function encryptFacultyIdentity(input: {
  pan: string;
  aadhar: string;
}) {
  return {
    panEncrypted: encryptSensitiveValue(input.pan.trim()),
    aadharEncrypted: encryptSensitiveValue(input.aadhar.trim()),
  };
}
