import express from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireRoles,
} from "../middleware/rbac";
import { prisma } from "../lib/prisma";
import { registerUser } from "../services/authService";
import { writeAuditLog } from "../lib/audit";

const router: express.Router = express.Router();

function facultyIncrement(totalPoints: number) {
  if (totalPoints < 16) return 5;
  if (totalPoints < 30) return 8;
  if (totalPoints < 45) return 10;
  return 15;
}

function parseHodAdditionalPoints(hodRemarks: string | null): number {
  if (!hodRemarks) return 0;
  try {
    const r = JSON.parse(hodRemarks);
    return typeof r.additionalPoints === "number" ? r.additionalPoints : 0;
  } catch {
    return 0;
  }
}

function parseHodAdditionalPointsRemark(hodRemarks: string | null): string | null {
  if (!hodRemarks) return null;
  try {
    const r = JSON.parse(hodRemarks);
    return typeof r.additionalPointsRemark === "string" ? r.additionalPointsRemark : null;
  } catch {
    return null;
  }
}

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
  // Use finalScore (set atomically by each reviewing stage and includes additionalPoints)
  // Fall back to item.points sum only if finalScore hasn't been set yet
  const totalSelectedPoints =
    appraisal.finalScore ??
    appraisal.items.reduce((sum: number, item: { points: number }) => sum + item.points, 0);
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
      const cycleIdParam =
        typeof req.query.cycleId === "string" ? req.query.cycleId : null;

      let effectiveCycleId: string | null = null;
      if (cycleIdParam && cycleIdParam !== "all") {
        effectiveCycleId = cycleIdParam;
      } else if (!cycleIdParam) {
        const activeCycle = await prisma.appraisalCycle.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        effectiveCycleId = activeCycle?.id ?? null;
      }

      const appraisals = await prisma.appraisal.findMany({
        where: {
          ...(effectiveCycleId ? { cycleId: effectiveCycleId } : {}),
          status: { in: ["HR_FINALIZED", "ADMIN_REVIEW", "FULLY_APPROVED"] },
        },
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
          items: { select: { id: true, key: true, points: true, notes: true, weight: true } },
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
        const hrReview =
          typeof parsed.hrReview === "object"
            ? (parsed.hrReview as {
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
          hrApprovedPoints:
            typeof hrReview?.approvedPoints === "number"
              ? Number(hrReview.approvedPoints)
              : null,
          hrRemark:
            typeof hrReview?.remark === "string"
              ? String(hrReview.remark)
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
          finalPercent: appraisal.finalPercent,
          additionalPoints: parseHodAdditionalPoints(appraisal.hodRemarks),
          additionalPointsRemark: parseHodAdditionalPointsRemark(appraisal.hodRemarks),
          superAdminApprovedPercent: appraisal.superAdminApprovedPercent,
          superAdminRemark: appraisal.superAdminRemark,
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
          message: "Appraisal is not pending HR review",
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

      const itemApproved = parsed.items.reduce(
        (sum, it) => sum + it.approvedPoints,
        0,
      );
      const hodAdditionalPoints = parseHodAdditionalPoints(appraisal.hodRemarks);
      const totalApproved = itemApproved + hodAdditionalPoints;
      const incrementPercent = facultyIncrement(totalApproved);

      // Single batched statement instead of one UPDATE per item.
      const hrReviewedAt = new Date().toISOString();
      const hrItemUpdateRows = parsed.items
        .map((reviewed) => {
          const existing = byId.get(reviewed.itemId);
          if (!existing) return null;

          const baseNotes = parseItemNotes(existing.notes);
          const nextNotes = {
            ...baseNotes,
            hrReview: {
              approvedPoints: reviewed.approvedPoints,
              remark: reviewed.remark?.trim() || null,
              reviewedBy: actorId,
              reviewedAt: hrReviewedAt,
            },
          } as Record<string, unknown>;

          return Prisma.sql`(${reviewed.itemId}::text, ${reviewed.approvedPoints}::int, ${JSON.stringify(nextNotes)}::text)`;
        })
        .filter((row): row is Prisma.Sql => row !== null);

      if (hrItemUpdateRows.length > 0) {
        await prisma.$executeRaw`
          UPDATE "AppraisalItem" AS ai
          SET points = v.points, notes = v.notes
          FROM (VALUES ${Prisma.join(hrItemUpdateRows)}) AS v(id, points, notes)
          WHERE ai.id = v.id
        `;
      }

      await Promise.all([
        prisma.appraisal.update({
          where: { id: appraisalId },
          data: {
            status: "ADMIN_REVIEW",
            finalScore: totalApproved,
            finalPercent: incrementPercent,
          },
        }),
        writeAuditLog({
          actorId,
          action: "appraisal.hr.review.completed",
          resource: "Appraisal",
          resourceId: appraisalId,
          meta: { itemApproved, hodAdditionalPoints, totalApproved, incrementPercent },
        }),
      ]);

      res.json({
        success: true,
        message: "Appraisal forwarded to Admin Review",
        data: { appraisalId, totalApprovedPoints: totalApproved, incrementPercent, forwardedStatus: "ADMIN_REVIEW" },
      });
    } catch (error) {
      next(error);
    }
  },
);

// HR rejection endpoint
const hrRejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

router.put(
  "/requests/:appraisalId/reject",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorId = req.auth?.sub;
      if (!actorId) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      const { appraisalId } = req.params;
      const { reason } = hrRejectSchema.parse(req.body ?? {});

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        select: { id: true, status: true },
      });

      if (!appraisal) {
        res.status(404).json({ success: false, message: "Appraisal not found" });
        return;
      }

      if (appraisal.status !== "HR_FINALIZED") {
        res.status(400).json({ success: false, message: "Appraisal cannot be rejected at this stage" });
        return;
      }

      await Promise.all([
        prisma.appraisal.update({
          where: { id: appraisalId },
          data: { status: "REJECTED", rejectedAt: new Date(), rejectedBy: actorId, rejectionReason: reason.trim() },
        }),
        writeAuditLog({
          actorId,
          action: "appraisal.hr.rejected",
          resource: "Appraisal",
          resourceId: appraisalId,
          meta: { reason },
        }),
      ]);

      res.json({ success: true, message: "Appraisal rejected", data: { appraisalId, status: "REJECTED" } });
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
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          facultyProfile: true,
          documents: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              module: true,
              fieldKey: true,
              viewUrl: true,
              directUrl: true,
            },
          },
          roles: { select: { role: true } },
          lockedUntil: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
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
        mustChangePassword: true,
      } as any);

      // assign roles if present (independent of the audit write, so run concurrently)
      const rolesToAssign =
        input.roles && input.roles.length > 0 ? input.roles : null;
      await Promise.all([
        rolesToAssign
          ? prisma.userRole.createMany({
              data: rolesToAssign.map((r) => ({ userId: user.id, role: r as any })),
            })
          : Promise.resolve(),
        writeAuditLog({
          actorId: req.auth?.sub || "",
          action: "hr.user.created",
          resource: "User",
          resourceId: user.id,
          meta: { email: user.email },
        }),
      ]);

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

// HR changes password for any non-admin user
const hrChangePasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

router.put(
  "/users/:userId/change-password",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = req.params;
      const { newPassword } = hrChangePasswordSchema.parse(req.body ?? {});

      const target = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
      });
      if (!target) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      const protectedRoles = ["SUPER_ADMIN", "ADMIN"];
      const hasProtectedRole = target.roles.some((r) => protectedRoles.includes(r.role));
      if (hasProtectedRole) {
        res.status(403).json({ success: false, message: "Cannot change password for admin accounts" });
        return;
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await Promise.all([
        prisma.user.update({
          where: { id: userId },
          data: { passwordHash: newHash, passwordChangedAt: new Date(), mustChangePassword: true },
        }),
        writeAuditLog({
          actorId: req.auth?.sub || "",
          action: "hr.user.password_changed",
          resource: "User",
          resourceId: userId,
          meta: { targetEmail: target.email },
        }),
      ]);

      res.json({ success: true, message: "Password changed successfully" });
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

      await Promise.all([
        prisma.user.update({
          where: { id: userId },
          data: { lockedUntil },
        }),
        writeAuditLog({
          actorId: req.auth?.sub || "",
          action: "hr.user.blocked",
          resource: "User",
          resourceId: userId,
          meta: { until: lockedUntil.toISOString() },
        }),
      ]);

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
      await Promise.all([
        prisma.user.update({
          where: { id: userId },
          data: { lockedUntil: null, failedLoginCount: 0 },
        }),
        writeAuditLog({
          actorId: req.auth?.sub || "",
          action: "hr.user.unblocked",
          resource: "User",
          resourceId: userId,
        }),
      ]);

      res.json({ success: true, message: "User unblocked", data: { userId } });
    } catch (error) {
      next(error);
    }
  },
);

// ── Departments ──────────────────────────────────────────────────────────────

// List departments with HOD, member count, and faculty list
router.get(
  "/departments",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const departments = await prisma.department.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          code: true,
          hodId: true,
          hod: { select: { id: true, firstName: true, lastName: true, email: true } },
          users: {
            where: { deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
            orderBy: { firstName: "asc" },
            take: 200,
          },
          _count: { select: { users: { where: { deletedAt: null } } } },
        },
        orderBy: { name: "asc" },
      });
      res.json({ success: true, message: "Departments", data: departments });
    } catch (error) {
      next(error);
    }
  },
);

const createDepartmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  hodId: z.string().optional(),
  hod: z
    .object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8, "Password must be at least 8 characters long"),
    })
    .optional(),
});

router.post(
  "/departments",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = createDepartmentSchema.parse(req.body ?? {});

      // Reject if both hodId and hod credentials provided simultaneously
      if (input.hodId && input.hod) {
        res.status(400).json({
          success: false,
          message: "Provide either hodId or hod credentials, not both",
        });
        return;
      }

      // If assigning existing HOD, ensure no other dept already has them
      if (input.hodId) {
        const existing = await prisma.department.findFirst({
          where: { hodId: input.hodId, deletedAt: null },
        });
        if (existing) {
          res.status(400).json({
            success: false,
            message: "This user is already HOD of another department",
          });
          return;
        }
      }

      let resolvedHodId: string | null = input.hodId ?? null;

      // Auto-create HOD user if credentials provided
      if (input.hod) {
        const existingUser = await prisma.user.findUnique({
          where: { email: input.hod.email },
        });
        if (existingUser) {
          res.status(400).json({
            success: false,
            message: "A user with this email already exists",
          });
          return;
        }

        const newHod = await registerUser({
          email: input.hod.email,
          password: input.hod.password,
          firstName: input.hod.firstName,
          lastName: input.hod.lastName,
        });

        resolvedHodId = newHod.id;

        await Promise.all([
          prisma.userRole.create({
            data: { userId: newHod.id, role: "HOD" },
          }),
          writeAuditLog({
            actorId: req.auth?.sub || "",
            action: "hr.hod.created",
            resource: "User",
            resourceId: newHod.id,
            meta: { email: input.hod.email, department: input.name },
          }),
        ]);
      }

      const department = await prisma.department.create({
        data: {
          name: input.name,
          code: input.code,
          hodId: resolvedHodId,
          ...(resolvedHodId
            ? { users: { connect: { id: resolvedHodId } } }
            : {}),
        },
        select: {
          id: true,
          name: true,
          code: true,
          hodId: true,
          hod: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "hr.department.created",
        resource: "Department",
        resourceId: department.id,
        meta: { name: department.name },
      });

      res.status(201).json({ success: true, message: "Department created", data: department });
    } catch (error) {
      next(error);
    }
  },
);

const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  hodId: z.string().nullable().optional(),
});

router.put(
  "/departments/:deptId",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { deptId } = req.params;
      const input = updateDepartmentSchema.parse(req.body ?? {});

      // If changing HOD, ensure no other dept has them
      if (input.hodId) {
        const existing = await prisma.department.findFirst({
          where: { hodId: input.hodId, deletedAt: null, id: { not: deptId } },
        });
        if (existing) {
          res.status(400).json({
            success: false,
            message: "This user is already HOD of another department",
          });
          return;
        }
      }

      const department = await prisma.department.update({
        where: { id: deptId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...("hodId" in input ? { hodId: input.hodId ?? null } : {}),
        },
        select: { id: true, name: true, code: true, hodId: true },
      });

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "hr.department.updated",
        resource: "Department",
        resourceId: deptId,
        meta: { name: department.name },
      });

      res.json({ success: true, message: "Department updated", data: department });
    } catch (error) {
      next(error);
    }
  },
);

// ── Cycles ────────────────────────────────────────────────────────────────────

// List all cycles
router.get(
  "/cycles",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const cycles = await prisma.appraisalCycle.findMany({
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          isActive: true,
          _count: { select: { appraisals: true } },
        },
        orderBy: { startDate: "desc" },
      });
      res.json({ success: true, message: "Cycles", data: cycles });
    } catch (error) {
      next(error);
    }
  },
);

const createCycleSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean().optional().default(false),
});

const updateCycleSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.post(
  "/cycles",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = createCycleSchema.parse(req.body ?? {});

      const cycle = await prisma.appraisalCycle.create({
        data: {
          name: input.name,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          isActive: input.isActive,
        },
        select: { id: true, name: true, startDate: true, endDate: true, isActive: true },
      });

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "hr.cycle.created",
        resource: "AppraisalCycle",
        resourceId: cycle.id,
        meta: { name: cycle.name, isActive: cycle.isActive },
      });

      res.status(201).json({ success: true, message: "Cycle created", data: cycle });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/cycles/:cycleId",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { cycleId } = req.params;
      const input = updateCycleSchema.parse(req.body ?? {});

      const cycle = await prisma.appraisalCycle.update({
        where: { id: cycleId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}),
          ...(input.endDate !== undefined ? { endDate: new Date(input.endDate) } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: { id: true, name: true, startDate: true, endDate: true, isActive: true },
      });

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "hr.cycle.updated",
        resource: "AppraisalCycle",
        resourceId: cycleId,
        meta: { name: cycle.name, isActive: cycle.isActive },
      });

      res.json({ success: true, message: "Cycle updated", data: cycle });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
