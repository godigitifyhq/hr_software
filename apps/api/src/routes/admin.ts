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

// Get all users with their roles
router.get(
  "/users",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const users = await prisma.user.findMany({
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
        orderBy: { createdAt: "desc" },
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
      const totalUsers = await prisma.user.count();
      const totalAppraisals = await prisma.appraisal.count();

      const appraisalsByStatus = await prisma.appraisal.groupBy({
        by: ["status"],
        _count: true,
      });

      const roleDistribution = await prisma.userRole.groupBy({
        by: ["role"],
        _count: true,
      });

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
      await prisma.userRole.create({
        data: { userId, role },
      });

      await writeAuditLog({
        actorId: req.auth?.sub || "",
        action: "admin.role_assigned",
        resource: "UserRole",
        resourceId: userId,
        meta: { role, userEmail: user.email },
      });

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

// List appraisals pending Super Admin approval
router.get(
  "/appraisals",
  authenticateRequest,
  requireRoles("SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { cycleId, departmentId, status } = req.query;

      // Allowed statuses for super admin view
      const validStatuses = [
        "SUPER_ADMIN_PENDING",
        "FULLY_APPROVED",
        "HR_FINALIZED",
      ];
      const requestedStatus = status as string;
      const finalStatus = validStatuses.includes(requestedStatus)
        ? requestedStatus
        : "SUPER_ADMIN_PENDING";

      const where: any = {
        status: finalStatus as any,
      };

      if (cycleId) {
        where.cycleId = cycleId as string;
      }

      if (departmentId) {
        where.user = { department: { id: departmentId as string } };
      }

      const appraisals = await prisma.appraisal.findMany({
        where,
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
              facultyProfile: {
                select: { currentSalary: true },
              },
            },
          },
          items: { select: { id: true, key: true, points: true, notes: true } },
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
        include: {
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
        include: {
          user: {
            select: {
              facultyProfile: { select: { currentSalary: true } },
            },
          },
          items: true,
        },
      });

      if (!appraisal) {
        res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
        return;
      }

      if (appraisal.status !== "SUPER_ADMIN_PENDING") {
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

      await prisma.$transaction(async (transaction) => {
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
      });

      await writeAuditLog({
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
      });

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
