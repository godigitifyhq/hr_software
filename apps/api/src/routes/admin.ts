import express from "express";
import { z } from "zod";
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireRoles,
} from "../middleware/rbac";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "../lib/audit";

const router: express.Router = express.Router();

// Combined dashboard endpoint — replaces separate /statistics + /users + /audit-logs calls
router.get(
  "/dashboard",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const [totalUsers, totalAppraisals, appraisalsByStatus, roleDistribution, users] =
        await Promise.all([
          prisma.user.count({ where: { deletedAt: null } }),
          prisma.appraisal.count(),
          prisma.appraisal.groupBy({ by: ["status"], _count: true }),
          prisma.userRole.groupBy({ by: ["role"], _count: true }),
          prisma.user.findMany({
            where: { deletedAt: null },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
              updatedAt: true,
              roles: { select: { role: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 200,
          }),
        ]);

      res.json({
        success: true,
        message: "Admin dashboard",
        data: {
          stats: { totalUsers, totalAppraisals, appraisalsByStatus, roleDistribution },
          users,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get all users with their roles
router.get(
  "/users",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          updatedAt: true,
          roles: { select: { role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      res.json({
        success: true,
        message: "All users",
        data: users,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get system statistics
router.get(
  "/statistics",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const [totalUsers, totalAppraisals, appraisalsByStatus, roleDistribution] =
        await Promise.all([
          prisma.user.count(),
          prisma.appraisal.count(),
          prisma.appraisal.groupBy({ by: ["status"], _count: true }),
          prisma.userRole.groupBy({ by: ["role"], _count: true }),
        ]);

      res.json({
        success: true,
        message: "System statistics",
        data: {
          totalUsers,
          totalAppraisals,
          appraisalsByStatus,
          roleDistribution,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get audit logs
router.get(
  "/audit-logs",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const logs = await prisma.auditLog.findMany({
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          meta: true,
          createdAt: true,
          actor: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      res.json({
        success: true,
        message: "Recent audit logs",
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Assign role to user
router.post(
  "/users/:userId/roles",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = req.params;
      const schema = z.object({
        role: z.enum([
          "FACULTY",
          "EMPLOYEE",
          "HOD",
          "COMMITTEE",
          "HR",
          "MANAGEMENT",
          "SUPER_ADMIN",
        ]),
      });
      const { role } = schema.parse(req.body);

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Check if user already has this role
      const existingRole = await prisma.userRole.findFirst({
        where: { userId, role },
      });

      if (existingRole) {
        res
          .status(400)
          .json({ success: false, message: "User already has this role" });
        return;
      }

      // Create the role assignment
      await Promise.all([
        prisma.userRole.create({
          data: { userId, role },
        }),
        writeAuditLog({
          actorId: req.auth?.sub || "",
          action: "admin.role_assigned",
          resource: "UserRole",
          resourceId: userId,
          meta: { role, userEmail: user.email },
        }),
      ]);

      res.json({
        success: true,
        message: `Role ${role} assigned to user`,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Remove role from user
router.delete(
  "/users/:userId/roles/:role",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId, role } = req.params;
      const validRoles = [
        "FACULTY",
        "EMPLOYEE",
        "HOD",
        "COMMITTEE",
        "HR",
        "MANAGEMENT",
        "SUPER_ADMIN",
      ];

      if (!validRoles.includes(role)) {
        res.status(400).json({ success: false, message: "Invalid role" });
        return;
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Delete the role
      const deleted = await prisma.userRole.deleteMany({
        where: { userId, role: role as any },
      });

      if (deleted.count === 0) {
        res
          .status(404)
          .json({ success: false, message: "Role not assigned to user" });
        return;
      }

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "admin.role_removed",
        resource: "UserRole",
        resourceId: userId,
        meta: { role, userEmail: user.email },
      });

      res.json({
        success: true,
        message: `Role ${role} removed from user`,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get user with their roles
router.get(
  "/users/:userId",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = _req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          updatedAt: true,
          roles: {
            select: {
              role: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "User retrieved",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },
);

// SUPER ADMIN APPRAISAL APPROVAL ROUTES

// Statuses relevant to the Super Admin approval dashboard (excludes DRAFT/SUBMITTED/
// HOD_REVIEW/COMMITTEE_REVIEW/REJECTED/CLOSED, which never reach this queue).
const SUPER_ADMIN_DASHBOARD_STATUSES = [
  "ADMIN_REVIEW",
  "SUPER_ADMIN_PENDING",
  "FULLY_APPROVED",
  "HR_FINALIZED",
];

// List appraisals pending Super Admin approval
router.get(
  "/appraisals",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { cycleId, departmentId, status } = req.query;

      const requestedStatus = status as string | undefined;
      const where: any = {};

      if (requestedStatus === "SUPER_ADMIN_PENDING" || requestedStatus === "ADMIN_REVIEW") {
        // "Pending" spans both statuses — appraisals can sit in either depending on workflow stage.
        where.status = { in: ["ADMIN_REVIEW", "SUPER_ADMIN_PENDING"] };
      } else if (requestedStatus === "FULLY_APPROVED" || requestedStatus === "HR_FINALIZED") {
        where.status = requestedStatus;
      } else {
        // "All Statuses" (empty) or unrecognized value — show everything relevant to this dashboard.
        where.status = { in: SUPER_ADMIN_DASHBOARD_STATUSES };
      }

      if (cycleId) {
        where.cycleId = cycleId as string;
      }

      if (departmentId) {
        where.user = { departmentId: departmentId as string };
      }

      const appraisals = await prisma.appraisal.findMany({
        where,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          finalScore: true,
          finalPercent: true,
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
              facultyProfile: {
                select: { currentSalary: true },
              },
            },
          },
          items: { select: { points: true } },
        },
        orderBy: { submittedAt: "desc" },
      });

      const payload = appraisals.map((appraisal) => {
        const totalPoints = appraisal.items.reduce((s, i) => s + i.points, 0);
        const finalPercent = (totalPoints / 4) * 100;

        return {
          id: appraisal.id,
          status: appraisal.status,
          submittedAt: appraisal.submittedAt,
          finalScore: appraisal.finalScore,
          finalPercent: appraisal.finalPercent ?? finalPercent,
          user: appraisal.user,
          cycle: appraisal.cycle,
          currentSalary: appraisal.user.facultyProfile?.currentSalary ?? 0,
          totalSelectedPoints: totalPoints,
          itemsCount: appraisal.items.length,
        };
      });

      res.json({
        success: true,
        message: "Super admin appraisal list",
        data: payload,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Aggregate stats for the summary cards — always computed across all statuses
// relevant to this dashboard (ignores the status filter, honors cycle/department filters)
// so the cards show true totals instead of just whatever the status filter narrowed to.
router.get(
  "/appraisals/stats",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { cycleId, departmentId } = req.query;

      const where: any = { status: { in: SUPER_ADMIN_DASHBOARD_STATUSES } };
      if (cycleId) {
        where.cycleId = cycleId as string;
      }
      if (departmentId) {
        where.user = { departmentId: departmentId as string };
      }

      // Counts are pushed to the DB (cheap native COUNT), while the salary-impact
      // figure still sums in JS from the minimal fields needed — kept identical
      // to the previous calculation (same fields, same per-row arithmetic, same
      // summation order) since it's a money calculation not worth any risk of
      // a raw-SQL floating-point mismatch.
      const [pendingCount, approvedCount, totalAppraisals, salaryRows] =
        await Promise.all([
          prisma.appraisal.count({
            where: { ...where, status: { in: ["ADMIN_REVIEW", "SUPER_ADMIN_PENDING"] } },
          }),
          prisma.appraisal.count({
            where: { ...where, status: "FULLY_APPROVED" },
          }),
          prisma.appraisal.count({ where }),
          prisma.appraisal.findMany({
            where,
            select: {
              finalPercent: true,
              user: {
                select: { facultyProfile: { select: { currentSalary: true } } },
              },
            },
          }),
        ]);

      let totalSalaryImpact = 0;
      for (const appraisal of salaryRows) {
        const currentSalary = appraisal.user.facultyProfile?.currentSalary ?? 0;
        const percent = appraisal.finalPercent ?? 0;
        totalSalaryImpact += (currentSalary * percent) / 100;
      }

      res.json({
        success: true,
        message: "Super admin appraisal stats",
        data: {
          pendingCount,
          approvedCount,
          totalSalaryImpact,
          totalAppraisals,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get appraisal detail for Super Admin approval
router.get(
  "/appraisals/:appraisalId",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { appraisalId } = req.params;

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        select: {
          id: true,
          status: true,
          finalScore: true,
          finalPercent: true,
          superAdminApprovedPercent: true,
          superAdminRemark: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              departmentId: true,
              department: { select: { id: true, name: true } },
              facultyProfile: {
                select: {
                  currentSalary: true,
                  lastIncrementDate: true,
                },
              },
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

      const totalPoints = appraisal.items.reduce((s, i) => s + i.points, 0);
      const finalPercent = appraisal.finalPercent ?? (totalPoints / 4) * 100;
      const currentSalary = appraisal.user.facultyProfile?.currentSalary ?? 0;
      const revisedSalary =
        currentSalary + (currentSalary * finalPercent) / 100;

      res.json({
        success: true,
        message: "Appraisal detail",
        data: {
          id: appraisal.id,
          status: appraisal.status,
          finalScore: appraisal.finalScore,
          finalPercent: finalPercent,
          user: appraisal.user,
          cycle: appraisal.cycle,
          items: appraisal.items,
          currentSalary,
          revisedSalary,
          superAdminApprovedPercent: appraisal.superAdminApprovedPercent,
          superAdminRemark: appraisal.superAdminRemark,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Super Admin approves appraisal with optional percentage adjustment
const superAdminApproveSchema = z.object({
  adjustedPercent: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.number().optional(),
  ),
  remark: z.string().optional(),
});

router.post(
  "/appraisals/:appraisalId/approve",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
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
      const parsed = superAdminApproveSchema.parse(req.body ?? {});

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        select: {
          id: true,
          userId: true,
          status: true,
          finalPercent: true,
          user: {
            select: {
              facultyProfile: { select: { currentSalary: true } },
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

      if (appraisal.status !== "ADMIN_REVIEW") {
        res.status(400).json({
          success: false,
          message: "Appraisal is not pending super admin approval",
        });
        return;
      }

      const finalPercent =
        parsed.adjustedPercent ?? appraisal.finalPercent ?? 0;
      const currentSalary = appraisal.user.facultyProfile?.currentSalary ?? 0;
      const revisedSalary =
        currentSalary + (currentSalary * finalPercent) / 100;

      // The audit write's fields are all already known pre-transaction and
      // don't depend on the transaction's outcome, so run it concurrently
      // instead of waiting for the transaction to finish first.
      await Promise.all([
        prisma.$transaction(async (transaction) => {
          // Update appraisal status and approval details
          await transaction.appraisal.update({
            where: { id: appraisalId },
            data: {
              status: "FULLY_APPROVED",
              superAdminApprovedPercent: finalPercent,
              superAdminRemark: parsed.remark?.trim() || null,
            },
          });

          // Update faculty profile with new salary
          if (appraisal.user.facultyProfile) {
            await transaction.facultyProfile.update({
              where: { userId: appraisal.userId },
              data: {
                currentSalary: revisedSalary,
                lastIncrementDate: new Date(),
              },
            });
          }
        }),
        writeAuditLog({
          actorId,
          action: "appraisal.super_admin.approved",
          resource: "Appraisal",
          resourceId: appraisalId,
          meta: {
            finalPercent,
            adjustedPercent: parsed.adjustedPercent,
            oldSalary: currentSalary,
            newSalary: revisedSalary,
          },
        }),
      ]);

      res.json({
        success: true,
        message: "Appraisal approved by super admin",
        data: {
          appraisalId,
          status: "FULLY_APPROVED",
          finalPercent,
          revisedSalary,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
