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
  isFacultyProfileComplete,
  serializeFacultyProfile,
} from "../lib/facultyProfile";
import {
  facultyAppraisalRequestSchema,
  facultyProfileSchema,
} from "../schemas/faculty";

const router: express.Router = express.Router();

type PolicyOption = {
  value: string;
  label: string;
  points: number;
};

type PolicyCriterion = {
  key: string;
  heading: string;
  options: PolicyOption[];
};

type AppraisalPolicy = {
  criteria: PolicyCriterion[];
  maxPoints: number;
  incrementBrackets: Array<{
    min: number;
    max?: number;
    incrementPercent: number;
  }>;
};

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const allowedEvidenceTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

const baseCriteria: PolicyCriterion[] = [
  {
    key: "academics_average_result",
    heading: "I. Academics Average Result (0 to 4)",
    options: [
      { value: "below_40", label: "Below 40%", points: 1 },
      { value: "between_40_60", label: "40 - 60%", points: 2 },
      { value: "between_60_80", label: "60 - 80%", points: 3 },
      { value: "above_80", label: "Above 80%", points: 4 },
    ],
  },
  {
    key: "scopus_papers",
    heading: "II. Scopus Paper Published / Accepted",
    options: [
      { value: "paper_1", label: "Paper 1", points: 1 },
      { value: "paper_2", label: "Paper 2", points: 2 },
      { value: "paper_3", label: "Paper 3", points: 3 },
      { value: "paper_4", label: "Paper 4", points: 4 },
    ],
  },
  {
    key: "impact_factor",
    heading: "III. Total Impact Factor During Assessment Year",
    options: [
      { value: "between_0_2", label: "0 to 2", points: 1 },
      { value: "between_2_5", label: "2 to 5", points: 2 },
      { value: "between_5_8", label: "5 to 8", points: 3 },
      { value: "above_8", label: "Above 8", points: 4 },
    ],
  },
  {
    key: "book_chapter_book_patent",
    heading: "IV. Book Chapter / Book / Patent",
    options: [
      { value: "book_chapter_1", label: "1 Book Chapter", points: 1 },
      {
        value: "book_or_design_patent_national",
        label:
          "Book Published / Design Patent / Book Edited / Book Authored (National Publisher)",
        points: 2,
      },
      {
        value: "book_or_edited_or_authored_international",
        label:
          "Book Published / Book Edited / Book Authored (International Publisher)",
        points: 3,
      },
      {
        value: "two_design_or_one_utility_granted",
        label: "2 Design Patent / 1 Utility Patent (Granted)",
        points: 4,
      },
    ],
  },
  {
    key: "conference_seminar_symposia",
    heading: "V. Conference / Seminar / Symposia",
    options: [
      { value: "attended_one", label: "Any one attended", points: 1 },
      {
        value: "presentation_national",
        label: "Presentation - National Conference / Seminar / Symposium",
        points: 2,
      },
      {
        value: "organized_or_multiple_presentations",
        label: "Organised Seminar / Presentation in two or more",
        points: 3,
      },
      {
        value: "organized_national_or_international",
        label: "Organised National / International Conference in Campus",
        points: 4,
      },
    ],
  },
  {
    key: "fdp_stp",
    heading: "VI. FDP / STP",
    options: [
      { value: "fdp_attended", label: "FDP attended", points: 1 },
      { value: "fdp_conducted", label: "FDP conducted", points: 2 },
      {
        value: "online_course_or_stp",
        label:
          "Online course certificate like Symposium / MOOC etc / STP in campus or outside campus",
        points: 3,
      },
      {
        value: "mooc_developed",
        label: "MOOC developed by faculty",
        points: 4,
      },
    ],
  },
  {
    key: "research_project_consultancy",
    heading: "VII. Research Project / Consultancy Granted During Academic Year",
    options: [
      { value: "between_10000_50000", label: "10,000 to 50,000", points: 1 },
      { value: "between_51000_100000", label: "51,000 to 1,00,000", points: 2 },
      {
        value: "between_100000_200000",
        label: "1,00,000 to 2,00,000",
        points: 3,
      },
      { value: "above_200000", label: "Above 2 Lakh", points: 4 },
    ],
  },
  {
    key: "research_guidance",
    heading: "VIII. Research Guidance [PG Thesis Guided]",
    options: [
      { value: "one_complete_thesis", label: "1 Complete Thesis", points: 1 },
      {
        value: "one_thesis_one_paper",
        label: "1 Complete Thesis + 1 Paper Published by Student",
        points: 2,
      },
      { value: "two_thesis", label: "2 Thesis", points: 3 },
      {
        value: "two_thesis_two_papers",
        label: "2 Thesis + 2 Papers Published by Student",
        points: 4,
      },
    ],
  },
  {
    key: "co_curricular_activities",
    heading: "IX. Co-Curricular Activities",
    options: [
      {
        value: "participate_institutional",
        label: "Participate in institutional events",
        points: 1,
      },
      {
        value: "coordinator_team_leader",
        label: "Coordinator / Team Leader",
        points: 2,
      },
      {
        value: "overall_coordinator",
        label: "Overall Coordinator / Organizer",
        points: 3,
      },
      { value: "sponsored_event", label: "Sponsored Event", points: 4 },
    ],
  },
  {
    key: "attendance",
    heading: "X. Attendance",
    options: [
      { value: "more_than_80", label: "More than 80%", points: 1 },
      { value: "more_than_90", label: "More than 90%", points: 2 },
      { value: "more_than_95", label: "More than 95%", points: 3 },
      { value: "hundred_percent", label: "100%", points: 4 },
    ],
  },
  {
    key: "awards_recognition",
    heading: "XI. Awards / Recognition / Employee of the Month",
    options: [
      {
        value: "university_or_community",
        label:
          "By university/community certificate or award/Employee of the Month",
        points: 1,
      },
      { value: "state_award", label: "State Award", points: 2 },
      {
        value: "national_award_or_two_times_employee",
        label: "National Award / 2 times Employee of the Month",
        points: 3,
      },
      { value: "more_than_one_award", label: "More than 1 award", points: 4 },
    ],
  },
  {
    key: "hod_remarks_score",
    heading: "XII. HOD's Remarks",
    options: [
      { value: "hod_1", label: "HOD remarks score 1", points: 1 },
      { value: "hod_2", label: "HOD remarks score 2", points: 2 },
      { value: "hod_3", label: "HOD remarks score 3", points: 3 },
      { value: "hod_4", label: "HOD remarks score 4", points: 4 },
    ],
  },
];

const hodOnlyCriteria: PolicyCriterion[] = [
  {
    key: "fee_recovery",
    heading: "XIII. Fee Recovery",
    options: [
      {
        value: "fifty_percent_next_sem",
        label: "50% fee of next semester",
        points: 1,
      },
      { value: "between_50_70", label: "50% to 70%", points: 2 },
      { value: "between_70_80", label: "70% to 80%", points: 3 },
      { value: "greater_than_80", label: "Greater than 80%", points: 4 },
    ],
  },
  {
    key: "awards_outside_svgoi",
    heading:
      "XIV. Awards Earned by Department Students in Events Organized Outside SVGOI",
    options: [
      { value: "upto_2_awards", label: "Upto 2 awards", points: 1 },
      { value: "winning_cash_prize", label: "Winning Cash Prize", points: 2 },
      { value: "nit_iit", label: "NIT / IIT", points: 3 },
      { value: "more_than_2_awards", label: "More than 2 awards", points: 4 },
    ],
  },
  {
    key: "overall_university_result",
    heading: "XV. Overall University Result",
    options: [
      {
        value: "thirty_percent",
        label: "30% student intake all clear",
        points: 1,
      },
      { value: "fifty_percent", label: "50%", points: 2 },
      { value: "seventy_percent", label: "70%", points: 3 },
      { value: "eighty_percent", label: "80%", points: 4 },
    ],
  },
  {
    key: "placement",
    heading: "XVI. Placement",
    options: [
      {
        value: "thirty_percent",
        label: "30% placement of passed students",
        points: 1,
      },
      { value: "between_30_50", label: "30 to 50%", points: 2 },
      { value: "between_50_70", label: "50 to 70%", points: 3 },
      { value: "more_than_70", label: "More than 70%", points: 4 },
    ],
  },
  {
    key: "department_university_positions",
    heading:
      "XVII. Position Earned by Department Students in University Academics",
    options: [
      { value: "between_0_5_students", label: "0 - 5 students", points: 1 },
      {
        value: "three_percent_students",
        label: "3% of total students",
        points: 2,
      },
      {
        value: "five_percent_students",
        label: "5% of total students",
        points: 3,
      },
      {
        value: "above_10_percent_students",
        label: "Above 10% students",
        points: 4,
      },
    ],
  },
];

const facultyPolicy: AppraisalPolicy = {
  criteria: [...baseCriteria],
  maxPoints: 48,
  incrementBrackets: [
    { min: 0, max: 12, incrementPercent: 5 },
    { min: 13, max: 20, incrementPercent: 8 },
    { min: 21, max: 30, incrementPercent: 10 },
    { min: 31, incrementPercent: 15 },
  ],
};

const hodPolicy: AppraisalPolicy = {
  criteria: [...baseCriteria, ...hodOnlyCriteria],
  maxPoints: 68,
  incrementBrackets: [
    { min: 0, max: 16, incrementPercent: 5 },
    { min: 17, max: 30, incrementPercent: 8 },
    { min: 31, max: 45, incrementPercent: 10 },
    { min: 46, incrementPercent: 15 },
  ],
};

function policyForRoles(roles: string[] = []): AppraisalPolicy {
  return roles.includes("HOD") ? hodPolicy : facultyPolicy;
}

function criteriaMap(policy: AppraisalPolicy) {
  return new Map(
    policy.criteria.map((criterion) => [criterion.key, criterion]),
  );
}

function calculateIncrement(totalPoints: number, policy: AppraisalPolicy) {
  const bracket = policy.incrementBrackets.find((entry) => {
    const lower = totalPoints >= entry.min;
    const upper =
      typeof entry.max === "number" ? totalPoints <= entry.max : true;
    return lower && upper;
  });
  return bracket?.incrementPercent ?? 0;
}

function getEvidenceUploadDir() {
  return path.join(process.cwd(), "uploads", "appraisal-evidence");
}

async function ensureEvidenceUploadDir() {
  await fs.mkdir(getEvidenceUploadDir(), { recursive: true });
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

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
      documents: {
        select: {
          id: true,
          module: true,
          fieldKey: true,
          name: true,
          originalName: true,
          mime: true,
          size: true,
          driveId: true,
          viewUrl: true,
          directUrl: true,
          folderId: true,
          storageProvider: true,
          uploadedAt: true,
          updatedAt: true,
          deletedAt: true,
        },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });
}

async function getActiveCycleOrThrow() {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
  });

  if (!cycle) {
    throw new Error("No active appraisal cycle found");
  }

  return cycle;
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

      const user = await getProfileUser(userId);
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "Profile retrieved",
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
        message: "Profile saved",
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
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "SUPER_ADMIN"),
  express.raw({
    type: Object.keys(allowedImageTypes),
    limit: "4mb",
  }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
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

router.get(
  "/appraisal/policy",
  authenticateRequest,
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    const policy = policyForRoles(req.auth?.roles || []);
    res.json({
      success: true,
      message: "Appraisal policy",
      data: policy,
    });
  },
);

router.get(
  "/appraisal/status",
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

      const cycle = await getActiveCycleOrThrow();
      const appraisal = await prisma.appraisal.findFirst({
        where: {
          userId,
          cycleId: cycle.id,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          finalScore: true,
          finalPercent: true,
        },
      });

      if (!appraisal) {
        res.json({
          success: true,
          message: "No appraisal request yet",
          data: { hasRequest: false },
        });
        return;
      }

      res.json({
        success: true,
        message: "Appraisal status",
        data: {
          hasRequest: true,
          appraisalId: appraisal.id,
          status: appraisal.status,
          submittedAt: appraisal.submittedAt?.toISOString() ?? null,
          totalPoints: appraisal.finalScore ?? null,
          incrementPercent: appraisal.finalPercent ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/appraisal/evidence/:criterionKey",
  authenticateRequest,
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "SUPER_ADMIN"),
  express.raw({
    type: Object.keys(allowedEvidenceTypes),
    limit: "5mb",
  }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const policy = policyForRoles(req.auth?.roles || []);
      const criteriaByKey = criteriaMap(policy);

      const criterionKey = req.params.criterionKey;
      if (!criteriaByKey.has(criterionKey)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid criterion key" });
        return;
      }

      const user = await getProfileUser(userId);
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      if (!isFacultyProfileComplete(user)) {
        res.status(400).json({
          success: false,
          message: "Complete profile before uploading evidence",
        });
        return;
      }

      const contentType = req.get("content-type")?.split(";")[0]?.trim() || "";
      const extension = allowedEvidenceTypes[contentType];
      const body = req.body;
      const originalFileName = req.get("x-file-name") || "evidence";

      if (!extension || !Buffer.isBuffer(body) || body.length === 0) {
        res
          .status(400)
          .json({ success: false, message: "Invalid evidence file" });
        return;
      }

      await ensureEvidenceUploadDir();
      const sanitizedName = sanitizeFileName(originalFileName);
      const fileName = `${userId}-${criterionKey}-${Date.now()}-${sanitizedName}${
        path.extname(sanitizedName) ? "" : extension
      }`;
      const filePath = path.join(getEvidenceUploadDir(), fileName);
      await fs.writeFile(filePath, body);

      const payload = {
        criterionKey,
        fileName: originalFileName,
        mime: contentType,
        size: body.length,
        url: `/uploads/appraisal-evidence/${fileName}`,
      };

      res.json({
        success: true,
        message: "Evidence uploaded",
        data: payload,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/appraisal/request",
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

      const user = await getProfileUser(userId);
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      if (!isFacultyProfileComplete(user)) {
        res.status(400).json({
          success: false,
          message: "Complete profile before requesting appraisal",
        });
        return;
      }

      const policy = policyForRoles(req.auth?.roles || []);
      const criteriaByKey = criteriaMap(policy);
      const parsed = facultyAppraisalRequestSchema.parse(req.body);
      const selectedByKey = new Map<string, (typeof parsed.items)[number]>();
      parsed.items.forEach((entry) => {
        selectedByKey.set(entry.criterionKey, entry);
      });

      if (selectedByKey.size !== policy.criteria.length) {
        res.status(400).json({
          success: false,
          message: "Please select one option for each criterion",
        });
        return;
      }

      const cycle = await getActiveCycleOrThrow();
      const existingAppraisal = await prisma.appraisal.findFirst({
        where: { userId, cycleId: cycle.id },
      });

      if (existingAppraisal && existingAppraisal.status !== "DRAFT") {
        res.status(400).json({
          success: false,
          message: "Appraisal already requested for the active cycle",
        });
        return;
      }

      const appraisalItems = policy.criteria.map((criterion) => {
        const selected = selectedByKey.get(criterion.key);
        if (!selected) {
          throw new Error(`Missing selection for ${criterion.key}`);
        }

        const criterionFromMap = criteriaByKey.get(criterion.key);
        const option = criterionFromMap?.options.find(
          (entry) => entry.value === selected.selectedValue,
        );

        if (!option) {
          throw new Error(`Invalid option for ${criterion.heading}`);
        }

        return {
          key: criterion.key,
          points: option.points,
          weight: 1,
          notes: JSON.stringify({
            heading: criterion.heading,
            selectedValue: option.value,
            selectedLabel: option.label,
            evidence: selected.evidence ?? null,
          }),
        };
      });

      const totalPoints = appraisalItems.reduce(
        (sum, item) => sum + item.points,
        0,
      );
      const incrementPercent = calculateIncrement(totalPoints, policy);

      const appraisalId =
        existingAppraisal?.id ??
        (
          await prisma.appraisal.create({
            data: {
              cycleId: cycle.id,
              userId,
              status: "DRAFT",
            },
            select: { id: true },
          })
        ).id;

      await prisma.$transaction(async (transaction) => {
        await transaction.appraisalItem.deleteMany({
          where: { appraisalId },
        });

        await transaction.appraisalItem.createMany({
          data: appraisalItems.map((item) => ({
            appraisalId,
            key: item.key,
            points: item.points,
            weight: item.weight,
            notes: item.notes,
          })),
        });

        await transaction.appraisal.update({
          where: { id: appraisalId },
          data: {
            status: "SUBMITTED",
            submittedAt: new Date(),
            locked: true,
            finalScore: totalPoints,
            finalPercent: incrementPercent,
          },
        });
      });

      res.json({
        success: true,
        message: "Appraisal request submitted successfully",
        data: {
          appraisalId,
          totalPoints,
          incrementPercent,
          status: "SUBMITTED",
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
