import { Prisma } from "@prisma/client";
import type { Document } from "@prisma/client";
import { prisma } from "./prisma";
import { deleteDriveFile, type DriveUploadResult } from "./googleDrive";
import {
  FACULTY_PROFILE_DOCUMENT_UPLOADS,
  getFacultyProfileDocumentConfig,
  type FacultyDocumentSummary,
  type FacultyProfileDocumentFieldKey,
} from "./facultyDocuments";

export const FACULTY_PROFILE_UPLOAD_MODULE = "faculty-profile";
export const APPRAISAL_EVIDENCE_UPLOAD_MODULE = "appraisal-evidence";

export const APPRAISAL_EVIDENCE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const APPRAISAL_EVIDENCE_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export type DocumentUploadRequest = {
  ownerId: string;
  module: string;
  fieldKey: string;
  name: string;
  originalName: string;
  mime: string;
  size: number;
  drive: DriveUploadResult;
  metadataJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

export type UploadValidationResult = {
  label: string;
  maxSizeBytes: number;
  acceptedMimeTypes: string[];
  required: boolean;
};

function normalizeFieldKey(fieldKey: string) {
  return fieldKey.trim();
}

export function getFacultyProfileUploadValidation(
  fieldKey: FacultyProfileDocumentFieldKey,
): UploadValidationResult {
  const config = getFacultyProfileDocumentConfig(fieldKey);

  if (!config) {
    throw new Error(`Unknown faculty profile upload field: ${fieldKey}`);
  }

  return {
    label: config.label,
    maxSizeBytes: config.maxSizeBytes,
    acceptedMimeTypes: config.accept,
    required: config.required,
  };
}

export function getAppraisalEvidenceValidation(): UploadValidationResult {
  return {
    label: "Appraisal evidence",
    maxSizeBytes: APPRAISAL_EVIDENCE_MAX_SIZE_BYTES,
    acceptedMimeTypes: APPRAISAL_EVIDENCE_ACCEPTED_MIME_TYPES,
    required: true,
  };
}

export function summarizeDocument(document: Document): FacultyDocumentSummary {
  return {
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
  };
}

export function buildUploadResponse(document: Document) {
  const summary = summarizeDocument(document);

  return {
    ...summary,
    criterionKey: document.fieldKey,
    fileName: document.originalName,
    url: document.viewUrl ?? document.directUrl ?? "",
  };
}

export function facultyProfileDocumentFields() {
  return FACULTY_PROFILE_DOCUMENT_UPLOADS;
}

export async function upsertUploadedDocument(request: DocumentUploadRequest) {
  const where = {
    ownerId_module_fieldKey: {
      ownerId: request.ownerId,
      module: request.module,
      fieldKey: normalizeFieldKey(request.fieldKey),
    },
  } as const;

  const existing = await prisma.document.findUnique({ where });
  const saved = await prisma.document.upsert({
    where,
    update: {
      name: request.name,
      originalName: request.originalName,
      mime: request.mime,
      size: request.size,
      driveId: request.drive.driveFileId,
      viewUrl: request.drive.viewUrl,
      directUrl: request.drive.directUrl,
      folderId: request.drive.folderId,
      storageProvider: "google-drive",
      metadataJson: request.metadataJson ?? Prisma.DbNull,
      deletedAt: null,
    },
    create: {
      ownerId: request.ownerId,
      module: request.module,
      fieldKey: normalizeFieldKey(request.fieldKey),
      name: request.name,
      originalName: request.originalName,
      mime: request.mime,
      size: request.size,
      driveId: request.drive.driveFileId,
      viewUrl: request.drive.viewUrl,
      directUrl: request.drive.directUrl,
      folderId: request.drive.folderId,
      storageProvider: "google-drive",
      metadataJson: request.metadataJson ?? Prisma.DbNull,
    },
  });

  if (existing?.driveId && existing.driveId !== request.drive.driveFileId) {
    await deleteDriveFile(existing.driveId);
  }

  return saved;
}
