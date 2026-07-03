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
  category?: "Academics" | "Research" | "Others";
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

function parseItemNotes(notes: string | null): Record<string, unknown> {
  if (!notes) {
    return {};
  }

  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

const baseCriteria: PolicyCriterion[] = [
  {
    key: "academics_average_result",
    heading: "I. Academics Average Result",
    category: "Academics",
    options: [
      { value: "below_40", label: "Below 40%", points: 1 },
      { value: "between_40_60", label: "40 – 60%", points: 2 },
      { value: "between_60_80", label: "60 – 80%", points: 3 },
      { value: "above_80", label: "Above 80%", points: 4 },
    ],
  },
  {
    key: "research_publications",
    heading: "II. Papers Published / Accepted (Scopus / SCI / ABDC / WOS / IEEE / PubMed)",
    category: "Research",
    options: [
      { value: "paper_1", label: "Paper 1", points: 1 },
      { value: "paper_2", label: "Paper 2", points: 2 },
      { value: "paper_3", label: "Paper 3", points: 3 },
      { value: "paper_4", label: "Paper 4", points: 4 },
    ],
  },
  {
    key: "impact_factor",
    heading: "III. Total Journal Impact Factor During Assessment Year",
    category: "Research",
    options: [
      { value: "between_0_2", label: "0 to 2", points: 1 },
      { value: "between_2_5", label: "2 to 5", points: 2 },
      { value: "between_5_8", label: "5 to 8", points: 3 },
      { value: "above_8", label: "Above 8", points: 4 },
    ],
  },
  {
    key: "books_published",
    heading: "IV. Books / Book Chapters Published",
    category: "Research",
    options: [
      { value: "book_chapter_1", label: "1 Book Chapter", points: 1 },
      {
        value: "book_national",
        label: "1 Book / Book Edited / Book Authored (National Publisher)",
        points: 2,
      },
      {
        value: "book_international",
        label: "1 Book / Book Edited / Book Authored (International Publisher)",
        points: 3,
      },
      {
        value: "book_national_and_international",
        label: "1 Book National + 1 Book International",
        points: 4,
      },
    ],
  },
  {
    key: "patents",
    heading: "V. Patents",
    category: "Research",
    options: [
      { value: "design_patent_1", label: "1 Design Patent", points: 1 },
      { value: "utility_patent_1", label: "1 Utility Patent", points: 2 },
      {
        value: "design_and_utility_patent",
        label: "1 Design Patent + 1 Utility Patent",
        points: 3,
      },
      { value: "utility_patents_2", label: "2 Utility Patents", points: 4 },
    ],
  },
  {
    key: "conference_seminar_workshop",
    heading: "VI. Conference / Seminar / Symposia / Workshop",
    category: "Research",
    options: [
      { value: "any_one_attended", label: "Any one attended", points: 1 },
      {
        value: "presentation_any_one",
        label: "Presentation in any one",
        points: 2,
      },
      {
        value: "organized_national_or_two_presentations",
        label:
          "Organized National Conference / Seminar / Symposium / Workshop / Presentation in two or more",
        points: 3,
      },
      {
        value: "organized_international_or_govt_funded",
        label:
          "Organized International Conference in Campus / Govt. Funded National Conference / Seminar / Symposium / Workshop",
        points: 4,
      },
    ],
  },
  {
    key: "fdp_stp",
    heading: "VII. FDPs / STPs",
    category: "Academics",
    options: [
      { value: "fdp_stp_attended", label: "FDP / STP Attended", points: 1 },
      { value: "fdp_stp_conducted", label: "FDP / STP Conducted", points: 2 },
      {
        value: "online_course_or_two_stp",
        label:
          "Online Course Certificate like SWAYAM / NPTEL / Coursera etc / Two STP attended in campus or outside campus",
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
    heading:
      "VIII. Research & Consultancy Projects Granted During Assessment Year (Rs.)",
    category: "Research",
    options: [
      { value: "10k_to_50k", label: "10,000 to 50,000", points: 1 },
      { value: "51k_to_100k", label: "51,000 to 1,00,000", points: 2 },
      { value: "100k_to_200k", label: "1,00,000 to 2,00,000", points: 3 },
      { value: "above_2_lakhs", label: "Above 2 Lakhs", points: 4 },
    ],
  },
  {
    key: "research_guidance",
    heading:
      "IX. Research Guidance [M.Tech / M.Pharm / M.Sc. / MCA etc. (PG Thesis Guided)]",
    category: "Research",
    options: [
      { value: "one_complete_thesis", label: "1 Complete Thesis", points: 1 },
      {
        value: "one_thesis_one_paper",
        label: "1 Complete Thesis + 1 Paper Published by Student",
        points: 2,
      },
      {
        value: "two_thesis_one_paper",
        label: "2 Complete Thesis + 1 Paper Published by Student",
        points: 3,
      },
      {
        value: "two_thesis_two_papers",
        label: "2 Complete Thesis + 2 Papers Published by Student",
        points: 4,
      },
    ],
  },
  {
    key: "co_curricular_activities",
    heading: "X. Co-Curricular Activities",
    category: "Others",
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
      {
        value: "sponsored_event",
        label: "Sponsored Event Organized",
        points: 4,
      },
    ],
  },
  {
    key: "attendance",
    heading: "XI. Attendance",
    category: "Others",
    options: [
      { value: "more_than_80", label: "More than 80%", points: 1 },
      { value: "more_than_90", label: "More than 90%", points: 2 },
      { value: "more_than_95", label: "More than 95%", points: 3 },
      { value: "hundred_percent", label: "100%", points: 4 },
    ],
  },
  {
    key: "awards_recognition",
    heading: "XII. Awards / Recognition / Employee of the Month",
    category: "Others",
    options: [
      {
        value: "university_or_community",
        label:
          "By University / Community Certificate or Award / Employee of the Month",
        points: 1,
      },
      { value: "state_award", label: "State Award", points: 2 },
      {
        value: "national_award_or_two_times_employee",
        label: "National Award / 2 Times Employee of the Month",
        points: 3,
      },
      {
        value: "more_than_one_award",
        label: "More than 1 above Awards",
        points: 4,
      },
    ],
  },
];

const hodOnlyCriteria: PolicyCriterion[] = [
  {
    key: "fee_recovery",
    heading: "XIV. Fee Recovery",
    category: "Others",
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
      "XV. Awards Earned by Department Students in Events Organized Outside SVGOI (1st, 2nd & 3rd Position)",
    category: "Others",
    options: [
      { value: "upto_2_awards", label: "Upto 2 awards", points: 1 },
      { value: "winning_cash_prize", label: "Winning Cash Prize", points: 2 },
      { value: "nit_iit", label: "NIT / IIT Awards", points: 3 },
      { value: "more_than_2_awards", label: "More than 2 awards", points: 4 },
    ],
  },
  {
    key: "overall_university_result",
    heading: "XVI. Overall University Result",
    category: "Academics",
    options: [
      {
        value: "fifty_percent",
        label: "50% student intake all clear",
        points: 1,
      },
      { value: "sixty_percent", label: "60%", points: 2 },
      { value: "seventy_percent", label: "70%", points: 3 },
      { value: "eighty_percent", label: "80%", points: 4 },
    ],
  },
  {
    key: "placement",
    heading: "XVII. Placement",
    category: "Academics",
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
      "XVIII. Position Earned by Department Students in University Academics",
    category: "Academics",
    options: [
      { value: "between_0_5_students", label: "0 – 5 students", points: 1 },
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
    { min: 0, max: 16, incrementPercent: 5 },
    { min: 17, max: 23, incrementPercent: 8 },
    { min: 24, max: 34, incrementPercent: 10 },
    { min: 35, incrementPercent: 15 },
  ],
};

const hodPolicy: AppraisalPolicy = {
  criteria: [...baseCriteria, ...hodOnlyCriteria],
  maxPoints: 68,
  incrementBrackets: [
    { min: 0, max: 20, incrementPercent: 5 },
    { min: 21, max: 34, incrementPercent: 8 },
    { min: 35, max: 49, incrementPercent: 10 },
    { min: 50, incrementPercent: 15 },
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
      email: true,
      phone: true,
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

// Join-date based appraisal window helpers
// Jan-Jun joiners → form open June 1 – July 31
// Jul-Dec joiners → form open December 1 – January 31 (next year)
function computeAppraisalWindow(
  dateOfJoining: Date,
  referenceYear: number,
): { open: Date; close: Date } {
  const joinMonth = dateOfJoining.getMonth() + 1; // 1-12
  if (joinMonth >= 1 && joinMonth <= 6) {
    return {
      open: new Date(referenceYear, 5, 1),            // June 1
      close: new Date(referenceYear, 6, 31, 23, 59, 59), // July 31
    };
  }
  return {
    open: new Date(referenceYear, 11, 1),              // December 1
    close: new Date(referenceYear + 1, 0, 31, 23, 59, 59), // January 31 next year
  };
}

function checkAppraisalWindow(dateOfJoining: Date | null, today: Date): {
  inWindow: boolean;
  windowOpen: string | null;
  windowClose: string | null;
} {
  if (!dateOfJoining) {
    // No join date recorded — don't block access
    return { inWindow: true, windowOpen: null, windowClose: null };
  }

  const joinMonth = dateOfJoining.getMonth() + 1;
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  if (joinMonth >= 1 && joinMonth <= 6) {
    // Window: June–July; check this year first
    const w = computeAppraisalWindow(dateOfJoining, todayYear);
    if (today > w.close) {
      // Past this year's window — report next year's window
      const next = computeAppraisalWindow(dateOfJoining, todayYear + 1);
      return { inWindow: false, windowOpen: next.open.toISOString(), windowClose: next.close.toISOString() };
    }
    return {
      inWindow: today >= w.open,
      windowOpen: w.open.toISOString(),
      windowClose: w.close.toISOString(),
    };
  }

  // Jul-Dec joiner: window December–January
  // If we're in January, the open was last December
  const windowYear = todayMonth === 1 ? todayYear - 1 : todayYear;
  const w = computeAppraisalWindow(dateOfJoining, windowYear);
  const inWindow = today >= w.open && today <= w.close;

  if (!inWindow && today > w.close) {
    // Past this window — show next December's window
    const next = computeAppraisalWindow(dateOfJoining, todayYear);
    return { inWindow: false, windowOpen: next.open.toISOString(), windowClose: next.close.toISOString() };
  }

  return {
    inWindow,
    windowOpen: w.open.toISOString(),
    windowClose: w.close.toISOString(),
  };
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
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "COMMITTEE", "SUPER_ADMIN"),
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
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "COMMITTEE", "SUPER_ADMIN"),
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
      const qualification = parsed.qualification?.trim() || null;
      const graduation = parsed.graduation?.trim() || null;
      const postGraduation = parsed.postGraduation?.trim() || null;
      const phdDegree = parsed.phdDegree?.trim() || null;

      const isHod = req.auth?.roles?.includes("HOD") ?? false;
      const lastIncrementDate = parsed.lastIncrementDate
        ? new Date(parsed.lastIncrementDate)
        : null;

      const profileData = {
        fatherName: parsed.fatherName.trim(),
        dob: new Date(parsed.dob),
        dateOfJoining: new Date(parsed.dateOfJoining),
        currentSalary: parsed.currentSalary,
        lastIncrementDate,
        panEncrypted: encryptedIdentity.panEncrypted,
        aadharEncrypted: encryptedIdentity.aadharEncrypted,
        tenthMarks: parsed.tenthMarks,
        twelfthMarks: parsed.twelfthMarks,
        qualification,
        graduation,
        postGraduation,
        otherPgDegree: parsed.otherPgDegree?.trim() || null,
        phdDegree,
        totalExperience: parsed.totalExperience,
        designation: parsed.designation?.trim() || null,
        employeeCode: parsed.employeeCode?.trim() || null,
        collegeName: parsed.collegeName?.trim() || null,
        profileRemarks: parsed.profileRemarks?.trim() || null,
      };

      const phoneUpdate = { phone: parsed.phone?.trim() || null };

      if (isHod) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: phoneUpdate,
          }),
          prisma.facultyProfile.upsert({
            where: { userId },
            update: profileData,
            create: { userId, ...profileData },
          }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { departmentId: parsed.departmentId, ...phoneUpdate },
          }),
          prisma.facultyProfile.upsert({
            where: { userId },
            update: profileData,
            create: { userId, ...profileData },
          }),
        ]);
      }

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
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "COMMITTEE", "SUPER_ADMIN"),
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
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "COMMITTEE", "SUPER_ADMIN"),
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
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "COMMITTEE", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const cycle = await prisma.appraisalCycle.findFirst({
        where: { isActive: true },
        orderBy: { startDate: "desc" },
      });

      if (!cycle) {
        res.json({
          success: true,
          message: "No active cycle",
          data: {
            hasRequest: false,
            cycleActive: false,
            inWindow: true,
            windowOpen: null,
            windowClose: null,
          },
        });
        return;
      }

      const appraisal = await prisma.appraisal.findFirst({
        where: { userId, cycleId: cycle.id },
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
          data: {
            hasRequest: false,
            cycleActive: true,
            cycle: { name: cycle.name, endDate: cycle.endDate.toISOString() },
            inWindow: true,
            windowOpen: null,
            windowClose: null,
          },
        });
        return;
      }

      // HOD's own appraisal should never sit at HOD_REVIEW — auto-advance to COMMITTEE_REVIEW.
      const isHodCaller = (req.auth?.roles ?? []).includes("HOD");
      let effectiveStatus = appraisal.status;
      if (isHodCaller && appraisal.status === "HOD_REVIEW") {
        // Response below is already computed from effectiveStatus, so this
        // housekeeping write doesn't need to block the read response.
        prisma.appraisal
          .update({
            where: { id: appraisal.id },
            data: { status: "COMMITTEE_REVIEW" },
          })
          .catch((err) =>
            console.error("Failed to auto-advance HOD appraisal status:", err),
          );
        effectiveStatus = "COMMITTEE_REVIEW";
      }

      res.json({
        success: true,
        message: "Appraisal status",
        data: {
          hasRequest: true,
          appraisalId: appraisal.id,
          status: effectiveStatus,
          submittedAt: appraisal.submittedAt?.toISOString() ?? null,
          totalPoints: appraisal.finalScore ?? null,
          incrementPercent: appraisal.finalPercent ?? null,
          cycleActive: true,
          cycle: { name: cycle.name, endDate: cycle.endDate.toISOString() },
          inWindow: true,
          windowOpen: null,
          windowClose: null,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// List all appraisal cycles with user's submission status
router.get(
  "/appraisal/cycles",
  authenticateRequest,
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "COMMITTEE", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      // Every appraisal.cycleId references an existing AppraisalCycle row (FK),
      // and `cycles` above is unfiltered (all cycles) — so filtering appraisals
      // by userId alone yields the exact same set as filtering by cycleId IN
      // (all cycle ids), letting both queries run concurrently instead of the
      // second depending on the first's result.
      const [cycles, appraisals] = await Promise.all([
        prisma.appraisalCycle.findMany({
          orderBy: { startDate: "desc" },
        }),
        prisma.appraisal.findMany({
          where: { userId },
          select: {
            id: true,
            cycleId: true,
            status: true,
            submittedAt: true,
            finalScore: true,
            finalPercent: true,
          },
        }),
      ]);

      const appraisalByCycle = new Map(
        appraisals.map((a) => [a.cycleId, a]),
      );

      const data = cycles.map((cycle) => {
        const appraisal = appraisalByCycle.get(cycle.id) ?? null;
        return {
          cycle: {
            id: cycle.id,
            name: cycle.name,
            startDate: cycle.startDate.toISOString(),
            endDate: cycle.endDate.toISOString(),
            isActive: cycle.isActive,
          },
          appraisal: appraisal
            ? {
                id: appraisal.id,
                status: appraisal.status,
                submittedAt: appraisal.submittedAt?.toISOString() ?? null,
                finalScore: appraisal.finalScore ?? null,
                finalPercent: appraisal.finalPercent ?? null,
              }
            : null,
        };
      });

      res.json({ success: true, message: "Appraisal cycles", data });
    } catch (error) {
      next(error);
    }
  },
);

// Get appraisal details - view submitted form
router.get(
  "/appraisal/:appraisalId",
  authenticateRequest,
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "COMMITTEE", "HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      const { appraisalId } = req.params;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: {
          cycle: {
            select: { id: true, name: true, startDate: true, endDate: true },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              departmentId: true,
              department: { select: { id: true, name: true } },
            },
          },
          items: {
            select: {
              id: true,
              key: true,
              points: true,
              weight: true,
              notes: true,
            },
          },
        },
      });

      if (!appraisal) {
        res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
        return;
      }

      // Access control: user can view their own, or HOD/COMMITTEE can view if in their purview
      const isOwnAppraisal = appraisal.user.id === userId;
      const userRoles = req.auth?.roles || [];
      const isAdmin =
        userRoles.includes("SUPER_ADMIN") || userRoles.includes("HR");

      if (!isOwnAppraisal && !isAdmin) {
        // HOD can view faculty from same dept, COMMITTEE can view assigned appraisals
        if (userRoles.includes("HOD")) {
          const dept = await prisma.department.findFirst({
            where: { hodId: userId },
            select: { id: true },
          });
          if (!dept || dept.id !== appraisal.user.departmentId) {
            res.status(403).json({ success: false, message: "Access denied" });
            return;
          }
        } else if (userRoles.includes("COMMITTEE")) {
          // Check if appraisal is assigned to this committee member
          const assignment = await prisma.committeeAssignment.findFirst({
            where: {
              appraisalId,
              committee: {
                members: {
                  some: { id: userId },
                },
              },
            },
          });
          if (!assignment) {
            res.status(403).json({ success: false, message: "Access denied" });
            return;
          }
        } else {
          res.status(403).json({ success: false, message: "Access denied" });
          return;
        }
      }

      // Parse item notes to extract selection and evidence
      const items = appraisal.items.map((item) => {
        const parsed = parseItemNotes(item.notes);

        const hodReview =
          typeof parsed.hodReview === "object" && parsed.hodReview
            ? (parsed.hodReview as Record<string, unknown>)
            : null;
        const committeeReview =
          typeof parsed.committeeReview === "object" && parsed.committeeReview
            ? (parsed.committeeReview as Record<string, unknown>)
            : null;

        return {
          id: item.id,
          criterionKey: item.key,
          heading:
            typeof parsed.heading === "string" ? parsed.heading : item.key,
          selectedValue:
            typeof parsed.selectedValue === "string"
              ? parsed.selectedValue
              : "",
          selectedLabel:
            typeof parsed.selectedLabel === "string"
              ? parsed.selectedLabel
              : "",
          facultyRemarks:
            typeof parsed.facultyRemarks === "string"
              ? parsed.facultyRemarks
              : null,
          facultyPoints: item.points,
          hodApprovedPoints:
            typeof hodReview?.approvedPoints === "number"
              ? hodReview.approvedPoints
              : item.points,
          hodRemark:
            typeof hodReview?.remark === "string" ? hodReview.remark : "",
          committeeApprovedPoints:
            typeof committeeReview?.approvedPoints === "number"
              ? committeeReview.approvedPoints
              : hodReview?.approvedPoints ?? item.points,
          committeeRemark:
            typeof committeeReview?.remark === "string"
              ? committeeReview.remark
              : "",
          evidence:
            typeof parsed.evidence === "object" &&
            Array.isArray(parsed.evidence)
              ? parsed.evidence
              : parsed.evidence
              ? [parsed.evidence]
              : [],
        };
      });

      const hodRemarksObj = appraisal.hodRemarks
        ? JSON.parse(appraisal.hodRemarks)
        : {};
      const committeeNotesObj = appraisal.committeeNotes
        ? JSON.parse(appraisal.committeeNotes)
        : {};

      res.json({
        success: true,
        message: "Appraisal details retrieved",
        data: {
          id: appraisal.id,
          status: appraisal.status,
          submittedAt: appraisal.submittedAt?.toISOString() ?? null,
          user: appraisal.user,
          cycle: appraisal.cycle,
          items,
          finalScore: appraisal.finalScore,
          finalPercent: appraisal.finalPercent,
          hodRemarks: hodRemarksObj,
          committeeNotes: committeeNotesObj,
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
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "COMMITTEE", "SUPER_ADMIN"),
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
  requireRoles("FACULTY", "EMPLOYEE", "HOD", "COMMITTEE", "SUPER_ADMIN"),
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

      if (!user.departmentId) {
        res.status(400).json({
          success: false,
          message: "Assign your department before requesting appraisal",
        });
        return;
      }

      // Department lookup and active-cycle lookup are independent of each other,
      // so fire them concurrently. allSettled (not all) keeps the original error
      // precedence intact: department validation below still runs, and reports,
      // before the cycle result is ever consulted.
      const [departmentResult, cycleResult] = await Promise.allSettled([
        prisma.department.findUnique({
          where: { id: user.departmentId },
          select: { id: true, name: true, hodId: true, deletedAt: true },
        }),
        getActiveCycleOrThrow(),
      ]);

      const department =
        departmentResult.status === "fulfilled" ? departmentResult.value : null;

      if (!department || department.deletedAt) {
        res.status(400).json({
          success: false,
          message: "Department is not configured for appraisal workflow",
        });
        return;
      }

      if (!department.hodId) {
        res.status(400).json({
          success: false,
          message:
            "No HOD is assigned to your department yet. Please contact HR/Admin.",
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

      if (cycleResult.status === "rejected") {
        throw cycleResult.reason;
      }
      const cycle = cycleResult.value;
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
        const criterionFromMap = criteriaByKey.get(criterion.key);
        const option = selected
          ? criterionFromMap?.options.find(
              (entry) => entry.value === selected.selectedValue,
            )
          : undefined;

        return {
          key: criterion.key,
          points: option?.points ?? 0,
          weight: 1,
          notes: JSON.stringify({
            heading: criterion.heading,
            selectedValue: option?.value ?? null,
            selectedLabel: option?.label ?? null,
            evidence: selected?.evidence ?? null,
            facultyRemarks: selected?.remarks?.trim() || null,
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

      // HOD submitting their own appraisal skips HOD review and goes directly to committee.
      const submissionStatus = (req.auth?.roles ?? []).includes("HOD")
        ? "COMMITTEE_REVIEW"
        : "HOD_REVIEW";

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
            status: submissionStatus,
            submittedAt: new Date(),
            // Store self-assessed score so the submitter can see it on the view page.
            // HR review will overwrite these with the final approved values.
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
          status: submissionStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

// HOD review endpoint - HOD approves/rejects a submitted appraisal
router.post(
  "/appraisal/:id/hod-review",
  authenticateRequest,
  requireRoles("HOD", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const reviewerId = req.auth?.sub;
      const appraisalId = req.params.id;
      const { action } = req.body as { action?: string };

      if (!action || (action !== "approve" && action !== "reject")) {
        res.status(400).json({
          success: false,
          message: 'Provide action: "approve" or "reject"',
        });
        return;
      }

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: { user: { include: { department: true } } },
      });
      if (!appraisal) {
        res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
        return;
      }

      // Ensure appraisal is pending HOD review
      if (appraisal.status !== "HOD_REVIEW") {
        res.status(400).json({
          success: false,
          message: "Appraisal is not pending HOD review",
        });
        return;
      }

      // Restrict to department HOD unless SUPER_ADMIN
      const reviewerIsSuper = req.auth?.roles?.includes("SUPER_ADMIN");
      const hodIdForUser = appraisal.user?.department?.hodId;
      if (!reviewerIsSuper && reviewerId !== hodIdForUser) {
        res.status(403).json({
          success: false,
          message: "Only the department HOD can review this appraisal",
        });
        return;
      }

      const comment = (req.body && (req.body as any).comment) || null;

      if (action === "approve") {
        await Promise.all([
          prisma.appraisal.update({
            where: { id: appraisalId },
            data: {
              status: "COMMITTEE_REVIEW",
            },
          }),
          prisma.auditLog.create({
            data: {
              actorId: reviewerId ?? undefined,
              action: "APPRAISAL_HOD_APPROVE",
              resource: "Appraisal",
              resourceId: appraisalId,
              meta: JSON.stringify({
                comment,
                previousStatus: appraisal.status,
                newStatus: "COMMITTEE_REVIEW",
              }),
            },
          }),
        ]);

        res.json({
          success: true,
          message: "Appraisal approved and forwarded to committee",
        });
        return;
      }

      // reject -> revert to DRAFT so faculty can edit/resubmit
      await Promise.all([
        prisma.appraisal.update({
          where: { id: appraisalId },
          data: {
            status: "DRAFT",
            locked: false,
            submittedAt: null,
          },
        }),
        prisma.auditLog.create({
          data: {
            actorId: reviewerId ?? undefined,
            action: "APPRAISAL_HOD_REJECT",
            resource: "Appraisal",
            resourceId: appraisalId,
            meta: JSON.stringify({
              comment,
              previousStatus: appraisal.status,
              newStatus: "DRAFT",
            }),
          },
        }),
      ]);

      res.json({
        success: true,
        message: "Appraisal rejected and reverted to draft",
      });
    } catch (error) {
      next(error);
    }
  },
);

// Committee review endpoint
router.post(
  "/appraisal/:id/committee-review",
  authenticateRequest,
  requireRoles("COMMITTEE", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const appraisalId = req.params.id;
      const { action } = req.body as { action?: string };

      if (!action || (action !== "approve" && action !== "reject")) {
        res.status(400).json({
          success: false,
          message: 'Provide action: "approve" or "reject"',
        });
        return;
      }

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
      });
      if (!appraisal) {
        res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
        return;
      }

      if (appraisal.status !== "COMMITTEE_REVIEW") {
        res.status(400).json({
          success: false,
          message: "Appraisal is not pending committee review",
        });
        return;
      }

      if (action === "approve") {
        await Promise.all([
          prisma.appraisal.update({
            where: { id: appraisalId },
            data: {
              status: "HR_FINALIZED",
            },
          }),
          prisma.auditLog.create({
            data: {
              actorId: req.auth?.sub ?? undefined,
              action: "APPRAISAL_COMMITTEE_APPROVE",
              resource: "Appraisal",
              resourceId: appraisalId,
              meta: JSON.stringify({
                comment: (req.body as any)?.comment ?? null,
                previousStatus: appraisal.status,
                newStatus: "HR_FINALIZED",
              }),
            },
          }),
        ]);

        res.json({
          success: true,
          message: "Appraisal approved and forwarded to HR",
        });
        return;
      }

      // reject -> revert to DRAFT
      await Promise.all([
        prisma.appraisal.update({
          where: { id: appraisalId },
          data: {
            status: "DRAFT",
            locked: false,
            submittedAt: null,
          },
        }),
        prisma.auditLog.create({
          data: {
            actorId: req.auth?.sub ?? undefined,
            action: "APPRAISAL_COMMITTEE_REJECT",
            resource: "Appraisal",
            resourceId: appraisalId,
            meta: JSON.stringify({
              comment: (req.body as any)?.comment ?? null,
              previousStatus: appraisal.status,
              newStatus: "DRAFT",
            }),
          },
        }),
      ]);

      res.json({
        success: true,
        message: "Appraisal rejected and reverted to draft",
      });
    } catch (error) {
      next(error);
    }
  },
);

// HR finalize endpoint - HR sets final score/percent and closes the appraisal
router.post(
  "/appraisal/:id/hr-finalize",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const appraisalId = req.params.id;
      const { finalScore, finalPercent } = req.body as {
        finalScore?: number;
        finalPercent?: number;
      };

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
      });
      if (!appraisal) {
        res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
        return;
      }

      if (appraisal.status !== "HR_FINALIZED") {
        res.status(400).json({
          success: false,
          message: "Appraisal is not pending HR finalization",
        });
        return;
      }

      await Promise.all([
        prisma.appraisal.update({
          where: { id: appraisalId },
          data: {
            status: "CLOSED",
            locked: true,
            finalScore: finalScore ?? appraisal.finalScore,
            finalPercent: finalPercent ?? appraisal.finalPercent,
          },
        }),
        prisma.auditLog.create({
          data: {
            actorId: req.auth?.sub ?? undefined,
            action: "APPRAISAL_HR_FINALIZE",
            resource: "Appraisal",
            resourceId: appraisalId,
            meta: JSON.stringify({
              finalScore: finalScore ?? appraisal.finalScore,
              finalPercent: finalPercent ?? appraisal.finalPercent,
            }),
          },
        }),
      ]);

      res.json({ success: true, message: "Appraisal finalized by HR" });
    } catch (error) {
      next(error);
    }
  },
);
