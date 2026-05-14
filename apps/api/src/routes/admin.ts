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

export default router;
