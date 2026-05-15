import express from "express";
import { z } from "zod";
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireRoles,
} from "../middleware/rbac";
import { prisma } from "../lib/prisma";
import { registerUser } from "../services/authService";
import { writeAuditLog } from "../lib/audit";

const router: express.Router = express.Router();

function parseItemNotes(notes: string | null) {
  if (!notes) return {};
  try {
    return JSON.parse(notes) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const hrReviewSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        approvedPoints: z.number().int().min(0),
        remark: z.string().optional(),
      }),
    )
    .min(1),
  overallRemark: z.string().optional(),
});

type HrAppraisalSummary = {
  id: string;
  status: string;
  submittedAt: Date | null;
  finalScore: number | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    department: { id: string; name: string } | null;
  };
  cycle: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  };
  totalSelectedPoints: number;
  itemsCount: number;
  finalPercent: number | null;
  currentSalary: number;
  superAdminApprovedPercent: number | null;
};

function mapHrAppraisal(appraisal: any): HrAppraisalSummary {
  const totalSelectedPoints = appraisal.items.reduce(
    (sum: number, item: { points: number }) => sum + item.points,
    0,
  );
  const currentSalary = appraisal.user.facultyProfile?.currentSalary ?? 0;
  const superAdminApprovedPercent = appraisal.superAdminApprovedPercent ?? null;

  return {
    id: appraisal.id,
    status: appraisal.status,
    submittedAt: appraisal.submittedAt,
    finalScore: appraisal.finalScore,
    user: appraisal.user,
    cycle: appraisal.cycle,
    totalSelectedPoints,
    itemsCount: appraisal.items.length,
    finalPercent: appraisal.finalPercent ?? null,
    currentSalary,
    superAdminApprovedPercent,
  };
}

// List appraisals ready for HR (HR_FINALIZED)
router.get(
  "/review-list",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const appraisals = await prisma.appraisal.findMany({
        where: { status: "HR_FINALIZED" },
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
              department: { select: { id: true, name: true } },
              facultyProfile: {
                select: { currentSalary: true },
              },
            },
          },
          items: { select: { id: true, key: true, points: true, notes: true } },
        },
        orderBy: { submittedAt: "desc" },
      });

      const payload = appraisals.map((appraisal) => mapHrAppraisal(appraisal));

      res.json({
        success: true,
        message: "HR appraisal review list",
        data: payload,
      });
    } catch (error) {
      next(error);
    }
  },
);

// List fully approved appraisals for HR salary sync
router.get(
  "/approved-list",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const appraisals = await prisma.appraisal.findMany({
        where: { status: "FULLY_APPROVED" },
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
              department: { select: { id: true, name: true } },
              facultyProfile: {
                select: { currentSalary: true },
              },
            },
          },
          items: { select: { id: true, key: true, points: true, notes: true } },
        },
        orderBy: { submittedAt: "desc" },
      });

      const payload = appraisals.map((appraisal) => mapHrAppraisal(appraisal));

      res.json({
        success: true,
        message: "HR approved appraisal list",
        data: payload,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get appraisal detail for HR
router.get(
  "/requests/:appraisalId",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { appraisalId } = req.params;

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              departmentId: true,
              department: { select: { id: true, name: true } },
              documents: {
                select: {
                  id: true,
                  name: true,
                  viewUrl: true,
                  directUrl: true,
                  module: true,
                  fieldKey: true,
                },
              },
              facultyProfile: true,
            },
          },
          cycle: {
            select: { id: true, name: true, startDate: true, endDate: true },
          },
          items: { select: { id: true, key: true, points: true, notes: true } },
        },
      });

      if (!appraisal) {
        res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
        return;
      }

      const items = appraisal.items.map((item) => {
        const parsed = parseItemNotes(item.notes);
        const hodReview =
          typeof parsed.hodReview === "object"
            ? (parsed.hodReview as {
                originalPoints?: number;
                approvedPoints?: number;
                remark?: string;
              })
            : null;
        const committeeReview =
          typeof parsed.committeeReview === "object"
            ? (parsed.committeeReview as {
                approvedPoints?: number;
                remark?: string;
              })
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
          facultyPoints:
            typeof hodReview?.originalPoints === "number"
              ? Number(hodReview.originalPoints)
              : item.points,
          hodApprovedPoints:
            typeof hodReview?.approvedPoints === "number"
              ? Number(hodReview.approvedPoints)
              : item.points,
          hodRemark:
            typeof hodReview?.remark === "string"
              ? String(hodReview.remark)
              : "",
          committeeApprovedPoints:
            typeof committeeReview?.approvedPoints === "number"
              ? Number(committeeReview.approvedPoints)
              : null,
          committeeRemark:
            typeof committeeReview?.remark === "string"
              ? String(committeeReview.remark)
              : "",
          evidence:
            typeof parsed.evidence === "object" && parsed.evidence
              ? parsed.evidence
              : null,
        };
      });

      res.json({
        success: true,
        message: "HR appraisal request detail",
        data: {
          id: appraisal.id,
          status: appraisal.status,
          submittedAt: appraisal.submittedAt,
          user: appraisal.user,
          cycle: appraisal.cycle,
          items,
          finalScore: appraisal.finalScore,
          committeeNotes: appraisal.committeeNotes,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// HR reviews and finalizes (close) appraisal
router.put(
  "/requests/:appraisalId/review",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorId = req.auth?.sub;
      if (!actorId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const { appraisalId } = req.params;
      const parsed = hrReviewSchema.parse(req.body ?? {});

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: { items: { select: { id: true, points: true, notes: true } } },
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

      if (parsed.items.length !== appraisal.items.length) {
        res.status(400).json({
          success: false,
          message: "Please review all criteria items before submitting",
        });
        return;
      }

      const byId = new Map(appraisal.items.map((i) => [i.id, i]));

      for (const reviewed of parsed.items) {
        const existing = byId.get(reviewed.itemId);
        if (!existing) {
          res.status(400).json({
            success: false,
            message: "Invalid item in review payload",
          });
          return;
        }

        // Determine current upper bound (committee or hod) from notes
        let upper = existing.points;
        if (existing.notes) {
          try {
            const parsedNotes = JSON.parse(existing.notes) as {
              committeeReview?: { approvedPoints?: number };
              hodReview?: { approvedPoints?: number };
            };
            if (
              typeof parsedNotes.committeeReview?.approvedPoints === "number"
            ) {
              upper = parsedNotes.committeeReview.approvedPoints;
            } else if (
              typeof parsedNotes.hodReview?.approvedPoints === "number"
            ) {
              upper = parsedNotes.hodReview.approvedPoints;
            }
          } catch {
            // ignore
          }
        }

        if (reviewed.approvedPoints > upper) {
          res.status(400).json({
            success: false,
            message: "Approved points cannot exceed previously approved points",
          });
          return;
        }

        if (reviewed.approvedPoints < upper && !reviewed.remark?.trim()) {
          res.status(400).json({
            success: false,
            message: "Remark is required for each deducted criterion",
          });
          return;
        }
      }

      const totalApproved = parsed.items.reduce(
        (sum, it) => sum + it.approvedPoints,
        0,
      );

      await prisma.$transaction(async (transaction) => {
        for (const reviewed of parsed.items) {
          const existing = byId.get(reviewed.itemId);
          if (!existing) continue;

          const baseNotes = parseItemNotes(existing.notes);
          const nextNotes = {
            ...baseNotes,
            hrReview: {
              approvedPoints: reviewed.approvedPoints,
              remark: reviewed.remark?.trim() || null,
              reviewedBy: actorId,
              reviewedAt: new Date().toISOString(),
            },
          } as Record<string, unknown>;

          await transaction.appraisalItem.update({
            where: { id: reviewed.itemId },
            data: {
              points: reviewed.approvedPoints,
              notes: JSON.stringify(nextNotes),
            },
          });
        }

        await transaction.appraisal.update({
          where: { id: appraisalId },
          data: {
            status: "SUPER_ADMIN_PENDING",
            finalScore: totalApproved,
          },
        });
      });

      await writeAuditLog({
        actorId,
        action: "appraisal.hr.review.completed",
        resource: "Appraisal",
        resourceId: appraisalId,
        meta: { totalApproved },
      });

      res.json({
        success: true,
        message: "Appraisal finalized for HR",
        data: { appraisalId, totalApprovedPoints: totalApproved },
      });
    } catch (error) {
      next(error);
    }
  },
);

// HR: list users (with documents/profile)
router.get(
  "/users",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          facultyProfile: true,
          documents: {
            select: {
              id: true,
              name: true,
              viewUrl: true,
              directUrl: true,
              module: true,
              fieldKey: true,
            },
          },
          roles: { select: { role: true } },
          lockedUntil: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, message: "Users for HR", data: users });
    } catch (error) {
      next(error);
    }
  },
);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  roles: z
    .array(
      z.enum([
        "FACULTY",
        "EMPLOYEE",
        "HOD",
        "COMMITTEE",
        "HR",
        "MANAGEMENT",
        "SUPER_ADMIN",
      ]),
    )
    .optional(),
  departmentId: z.string().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  roles: z
    .array(
      z.enum([
        "FACULTY",
        "EMPLOYEE",
        "HOD",
        "COMMITTEE",
        "HR",
        "MANAGEMENT",
        "SUPER_ADMIN",
      ]),
    )
    .optional(),
  departmentId: z.string().optional(),
});

router.post(
  "/users",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = createUserSchema.parse(req.body ?? {});

      // Create user via auth service to ensure proper hashing
      const user = await registerUser({
        email: input.email,
        password: input.password,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: undefined,
        departmentId: input.departmentId,
      } as any);

      // assign roles if present
      if (input.roles && input.roles.length > 0) {
        await prisma.userRole.createMany({
          data: input.roles.map((r) => ({ userId: user.id, role: r as any })),
        });
      }

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "hr.user.created",
        resource: "User",
        resourceId: user.id,
        meta: { email: user.email },
      });

      res.status(201).json({
        success: true,
        message: "User created",
        data: { id: user.id, email: user.email },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/users/:userId",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = req.params;
      const input = updateUserSchema.parse(req.body ?? {});

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          departmentId: input.departmentId,
        },
      });

      if (input.roles) {
        await prisma.userRole.deleteMany({ where: { userId } });
        if (input.roles.length > 0) {
          await prisma.userRole.createMany({
            data: input.roles.map((role) => ({ userId, role: role as any })),
          });
        }
      }

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "hr.user.updated",
        resource: "User",
        resourceId: user.id,
        meta: {
          email: user.email,
          roles: input.roles ?? null,
          departmentId: input.departmentId ?? null,
        },
      });

      res.json({
        success: true,
        message: "User updated",
        data: { id: user.id, email: user.email },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Block user (temporary block by setting lockedUntil)
const blockSchema = z.object({ until: z.string().optional() });

router.put(
  "/users/:userId/block",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = req.params;
      const { until } = blockSchema.parse(req.body ?? {});

      const lockedUntil = until
        ? new Date(until)
        : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

      await prisma.user.update({
        where: { id: userId },
        data: { lockedUntil },
      });

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "hr.user.blocked",
        resource: "User",
        resourceId: userId,
        meta: { until: lockedUntil.toISOString() },
      });

      res.json({
        success: true,
        message: "User blocked",
        data: { userId, lockedUntil },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/users/:userId/unblock",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = req.params;
      await prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: null, failedLoginCount: 0 },
      });

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "hr.user.unblocked",
        resource: "User",
        resourceId: userId,
      });

      res.json({ success: true, message: "User unblocked", data: { userId } });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
