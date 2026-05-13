import express from "express";
import fs from "fs/promises";
import path from "path";
import {
  AuthenticatedRequest,
  authenticateRequest,
  requireRoles,
} from "../middleware/rbac";
import { prisma } from "../lib/prisma";
import {
  ensureFacultyUploadDir,
  encryptFacultyIdentity,
  facultyUploadDir,
  serializeFacultyProfile,
} from "../lib/facultyProfile";
import { facultyProfileSchema } from "../schemas/faculty";

const router: express.Router = express.Router();

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function getProfileUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      facultyProfile: true,
    },
  });
}

async function deletePreviousImage(imageUrl: string | null) {
  if (!imageUrl) {
    return;
  }

  const fileName = path.basename(imageUrl);
  const filePath = path.join(facultyUploadDir, fileName);

  try {
    await fs.unlink(filePath);
  } catch {
    // Best effort cleanup only.
  }
}

router.get(
  "/profile",
  authenticateRequest,
  requireRoles("FACULTY", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      const user = await getProfileUser(userId);
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "Faculty profile retrieved",
        data: serializeFacultyProfile(user),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/profile",
  authenticateRequest,
  requireRoles("FACULTY", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      const parsed = facultyProfileSchema.parse(req.body);
      const encryptedIdentity = encryptFacultyIdentity({
        pan: parsed.pan,
        aadhar: parsed.aadhar,
      });

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            departmentId: parsed.departmentId,
          },
        }),
        prisma.facultyProfile.upsert({
          where: { userId },
          update: {
            fatherName: parsed.fatherName.trim(),
            dob: new Date(parsed.dob),
            dateOfJoining: new Date(parsed.dateOfJoining),
            currentSalary: parsed.currentSalary,
            lastIncrementDate: new Date(parsed.lastIncrementDate),
            panEncrypted: encryptedIdentity.panEncrypted,
            aadharEncrypted: encryptedIdentity.aadharEncrypted,
            tenthMarks: parsed.tenthMarks,
            twelfthMarks: parsed.twelfthMarks,
            qualification: parsed.qualification.trim(),
            graduation: parsed.graduation.trim(),
            postGraduation: parsed.postGraduation?.trim() || null,
            phdDegree: parsed.phdDegree?.trim() || null,
            totalExperience: parsed.totalExperience,
          },
          create: {
            userId,
            fatherName: parsed.fatherName.trim(),
            dob: new Date(parsed.dob),
            dateOfJoining: new Date(parsed.dateOfJoining),
            currentSalary: parsed.currentSalary,
            lastIncrementDate: new Date(parsed.lastIncrementDate),
            panEncrypted: encryptedIdentity.panEncrypted,
            aadharEncrypted: encryptedIdentity.aadharEncrypted,
            tenthMarks: parsed.tenthMarks,
            twelfthMarks: parsed.twelfthMarks,
            qualification: parsed.qualification.trim(),
            graduation: parsed.graduation.trim(),
            postGraduation: parsed.postGraduation?.trim() || null,
            phdDegree: parsed.phdDegree?.trim() || null,
            totalExperience: parsed.totalExperience,
          },
        }),
      ]);

      const user = await getProfileUser(userId);
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "Faculty profile saved",
        data: serializeFacultyProfile(user),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/profile/image",
  authenticateRequest,
  requireRoles("FACULTY", "SUPER_ADMIN"),
  express.raw({
    type: Object.keys(allowedImageTypes),
    limit: "4mb",
  }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      const contentType = req.get("content-type")?.split(";")[0]?.trim() || "";
      const extension = allowedImageTypes[contentType];
      const body = req.body;

      if (!extension || !Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({
          success: false,
          message: "Upload a valid image file",
        });
        return;
      }

      ensureFacultyUploadDir();

      const existing = await prisma.facultyProfile.findUnique({
        where: { userId },
        select: { imageUrl: true },
      });

      const fileName = `${userId}-${Date.now()}${extension}`;
      const filePath = path.join(facultyUploadDir, fileName);
      await fs.writeFile(filePath, body);

      const imageUrl = `/uploads/faculty-profile/${fileName}`;

      await prisma.facultyProfile.upsert({
        where: { userId },
        update: { imageUrl },
        create: {
          userId,
          imageUrl,
        },
      });

      await deletePreviousImage(existing?.imageUrl ?? null);

      const user = await getProfileUser(userId);
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "Profile image uploaded",
        data: serializeFacultyProfile(user),
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
