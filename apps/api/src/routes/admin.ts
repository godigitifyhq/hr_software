import express from "express";
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireRoles,
} from "../middleware/rbac";
import { prisma } from "../lib/prisma";

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

export default router;
