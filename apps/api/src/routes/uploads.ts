import express from "express";
import multer from "multer";
import type { Prisma } from "@prisma/client";
import type { AuthenticatedRequest } from "../middleware/rbac";
import { authenticateRequest, requireRoles } from "../middleware/rbac";
import { prisma } from "../lib/prisma";
import { uploadBufferToDrive } from "../lib/googleDrive";
import {
  APPRAISAL_EVIDENCE_UPLOAD_MODULE,
  buildUploadResponse,
  getAppraisalEvidenceValidation,
  getFacultyProfileUploadValidation,
  upsertUploadedDocument,
} from "../lib/documentUploads";
import {
  FACULTY_PROFILE_DOCUMENT_UPLOADS,
  type FacultyProfileDocumentFieldKey,
} from "../lib/facultyDocuments";

const router: express.Router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

const uploadSingle = upload.single("file");

function runUploadMiddleware(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadSingle(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getModuleValidation(moduleName: string, fieldKey: string) {
  if (moduleName === "faculty-profile") {
    const config = getFacultyProfileUploadValidation(
      fieldKey as FacultyProfileDocumentFieldKey,
    );

    return {
      label: config.label,
      acceptedMimeTypes: config.acceptedMimeTypes,
      maxSizeBytes: config.maxSizeBytes,
      required: config.required,
    };
  }

  if (moduleName === APPRAISAL_EVIDENCE_UPLOAD_MODULE) {
    const config = getAppraisalEvidenceValidation();
    return config;
  }

  return {
    label: fieldKey,
    acceptedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    maxSizeBytes: 10 * 1024 * 1024,
    required: false,
  };
}

function parseMetadata(rawValue: unknown) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

router.post(
  "/:module/:fieldKey",
  authenticateRequest,
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const moduleName = req.params.module?.trim();
      const fieldKey = req.params.fieldKey?.trim();

      if (!moduleName || !fieldKey) {
        res
          .status(400)
          .json({ success: false, message: "Missing upload target" });
        return;
      }

      let validation;
      try {
        validation = getModuleValidation(moduleName, fieldKey);
      } catch (validationError) {
        res.status(400).json({
          success: false,
          message:
            validationError instanceof Error
              ? validationError.message
              : "Invalid upload target",
        });
        return;
      }

      await runUploadMiddleware(req, res);

      const file = (
        req as AuthenticatedRequest & {
          file?: Express.Multer.File;
        }
      ).file;

      if (!file || !file.buffer || file.buffer.length === 0) {
        res
          .status(400)
          .json({ success: false, message: "Upload a valid file" });
        return;
      }

      if (!validation.acceptedMimeTypes.includes(file.mimetype)) {
        res.status(400).json({
          success: false,
          message: `Unsupported file type. Allowed: ${validation.acceptedMimeTypes.join(
            ", ",
          )}`,
        });
        return;
      }

      if (file.size > validation.maxSizeBytes) {
        res.status(400).json({
          success: false,
          message: `File size must be ${Math.round(
            validation.maxSizeBytes / (1024 * 1024),
          )}MB or less`,
        });
        return;
      }

      if (moduleName === "faculty-profile") {
        const allowedFieldKeys = new Set(
          FACULTY_PROFILE_DOCUMENT_UPLOADS.map((entry) => entry.fieldKey),
        );
        if (!allowedFieldKeys.has(fieldKey as FacultyProfileDocumentFieldKey)) {
          res
            .status(400)
            .json({
              success: false,
              message: "Invalid faculty document field",
            });
          return;
        }
      }

      const metadata = parseMetadata(req.body?.metadata);
      const displayName =
        typeof req.body?.label === "string" && req.body.label.trim().length > 0
          ? req.body.label.trim()
          : validation.label;
      const originalName = file.originalname || displayName;
      const uploaded = await uploadBufferToDrive({
        fileName: originalName,
        mimeType: file.mimetype,
        buffer: file.buffer,
        folderId:
          moduleName === "faculty-profile"
            ? process.env.GOOGLE_DRIVE_FACULTY_FOLDER_ID || undefined
            : moduleName === APPRAISAL_EVIDENCE_UPLOAD_MODULE
            ? process.env.GOOGLE_DRIVE_APPRAISAL_FOLDER_ID || undefined
            : process.env.GOOGLE_DRIVE_FOLDER_ID || undefined,
        description: `${moduleName}:${fieldKey}`,
        appProperties: {
          module: moduleName,
          fieldKey,
          ownerId: userId,
        },
      });

      const saved = await upsertUploadedDocument({
        ownerId: userId,
        module: moduleName,
        fieldKey,
        name: displayName,
        originalName,
        mime: file.mimetype,
        size: file.size,
        drive: uploaded,
        metadataJson: metadata ?? undefined,
      });

      if (moduleName === "faculty-profile" && fieldKey === "profilePicture") {
        await prisma.facultyProfile.upsert({
          where: { userId },
          update: { imageUrl: uploaded.directUrl },
          create: { userId, imageUrl: uploaded.directUrl },
        });
      }

      res.json({
        success: true,
        message: "File uploaded successfully",
        data: {
          ...buildUploadResponse(saved),
          validation,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
