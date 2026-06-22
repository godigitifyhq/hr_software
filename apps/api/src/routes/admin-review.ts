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

function parseItemNotes(notes: string | null) {
  if (!notes) return {};
  try {
    return JSON.parse(notes) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const adminReviewSchema = z.object({
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

const adminRejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

// List appraisals in ADMIN_REVIEW status
router.get(
  "/review-list",
  authenticateRequest,
  requireRoles("MANAGEMENT", "SUPER_ADMIN"),
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
          status: { in: ["ADMIN_REVIEW", "FULLY_APPROVED", "REJECTED"] },
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
              facultyProfile: { select: { currentSalary: true } },
            },
          },
          items: { select: { id: true, key: true, points: true } },
        },
        orderBy: { submittedAt: "desc" },
      });

      const payload = appraisals.map((a) => ({
        id: a.id,
        status: a.status,
        submittedAt: a.submittedAt,
        finalScore: a.finalScore,
        user: a.user,
        cycle: a.cycle,
        totalSelectedPoints: a.items.reduce((sum, i) => sum + i.points, 0),
        itemsCount: a.items.length,
        finalPercent: a.finalPercent,
        currentSalary: a.user.facultyProfile?.currentSalary ?? 0,
      }));

      res.json({ success: true, message: "Admin review list", data: payload });
    } catch (error) {
      next(error);
    }
  },
);

// Get appraisal detail for admin review
router.get(
  "/requests/:appraisalId",
  authenticateRequest,
  requireRoles("MANAGEMENT", "SUPER_ADMIN"),
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
        res.status(404).json({ success: false, message: "Appraisal not found" });
        return;
      }

      const items = appraisal.items.map((item) => {
        const parsed = parseItemNotes(item.notes);
        const hodReview =
          typeof parsed.hodReview === "object" && parsed.hodReview
            ? (parsed.hodReview as { originalPoints?: number; approvedPoints?: number; remark?: string })
            : null;
        const adminReview =
          typeof parsed.adminReview === "object" && parsed.adminReview
            ? (parsed.adminReview as { approvedPoints?: number; remark?: string })
            : null;

        return {
          id: item.id,
          criterionKey: item.key,
          heading: typeof parsed.heading === "string" ? parsed.heading : item.key,
          selectedValue: typeof parsed.selectedValue === "string" ? parsed.selectedValue : "",
          selectedLabel: typeof parsed.selectedLabel === "string" ? parsed.selectedLabel : "",
          facultyRemarks: typeof parsed.facultyRemarks === "string" ? parsed.facultyRemarks : null,
          facultyPoints:
            typeof hodReview?.originalPoints === "number"
              ? Number(hodReview.originalPoints)
              : item.points,
          hodApprovedPoints:
            typeof hodReview?.approvedPoints === "number"
              ? Number(hodReview.approvedPoints)
              : item.points,
          hodRemark: typeof hodReview?.remark === "string" ? String(hodReview.remark) : "",
          adminApprovedPoints:
            typeof adminReview?.approvedPoints === "number"
              ? Number(adminReview.approvedPoints)
              : null,
          adminRemark: typeof adminReview?.remark === "string" ? String(adminReview.remark) : "",
          evidence:
            typeof parsed.evidence === "object" && parsed.evidence ? parsed.evidence : null,
        };
      });

      const hodRemarks = parseItemNotes(appraisal.hodRemarks);

      res.json({
        success: true,
        message: "Admin appraisal detail",
        data: {
          id: appraisal.id,
          status: appraisal.status,
          submittedAt: appraisal.submittedAt,
          user: appraisal.user,
          cycle: appraisal.cycle,
          items,
          finalScore: appraisal.finalScore,
          finalPercent: appraisal.finalPercent,
          additionalPoints:
            typeof hodRemarks.additionalPoints === "number" ? hodRemarks.additionalPoints : 0,
          hodOverallRemark:
            typeof hodRemarks.overallRemark === "string" ? hodRemarks.overallRemark : "",
          adminRemark: appraisal.adminRemark ?? "",
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Admin reviews appraisal — forwards to HR_FINALIZED
router.put(
  "/requests/:appraisalId/review",
  authenticateRequest,
  requireRoles("MANAGEMENT", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorId = req.auth?.sub;
      if (!actorId) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      const { appraisalId } = req.params;
      const parsed = adminReviewSchema.parse(req.body ?? {});

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: { items: { select: { id: true, points: true, notes: true } } },
      });

      if (!appraisal) {
        res.status(404).json({ success: false, message: "Appraisal not found" });
        return;
      }

      if (appraisal.status !== "ADMIN_REVIEW") {
        res.status(400).json({ success: false, message: "Appraisal is not pending admin review" });
        return;
      }

      if (parsed.items.length !== appraisal.items.length) {
        res.status(400).json({ success: false, message: "Please review all criteria items before submitting" });
        return;
      }

      const byId = new Map(appraisal.items.map((i) => [i.id, i]));

      for (const reviewed of parsed.items) {
        const existing = byId.get(reviewed.itemId);
        if (!existing) {
          res.status(400).json({ success: false, message: "Invalid item in review payload" });
          return;
        }

        let hodApprovedPoints = existing.points;
        if (existing.notes) {
          try {
            const n = JSON.parse(existing.notes) as { hodReview?: { approvedPoints?: number } };
            if (typeof n.hodReview?.approvedPoints === "number") {
              hodApprovedPoints = n.hodReview.approvedPoints;
            }
          } catch { /* ignore */ }
        }

        if (reviewed.approvedPoints > hodApprovedPoints) {
          res.status(400).json({
            success: false,
            message: "Admin approved points cannot exceed HOD approved points",
          });
          return;
        }

        if (reviewed.approvedPoints < hodApprovedPoints && !reviewed.remark?.trim()) {
          res.status(400).json({ success: false, message: "Remark is required for each deducted criterion" });
          return;
        }
      }

      const totalApproved = parsed.items.reduce((sum, i) => sum + i.approvedPoints, 0);

      await prisma.$transaction(async (transaction) => {
        for (const reviewed of parsed.items) {
          const existing = byId.get(reviewed.itemId);
          if (!existing) continue;

          const baseNotes = parseItemNotes(existing.notes);
          const nextNotes = {
            ...baseNotes,
            adminReview: {
              approvedPoints: reviewed.approvedPoints,
              remark: reviewed.remark?.trim() || null,
              reviewedBy: actorId,
              reviewedAt: new Date().toISOString(),
            },
          };

          await transaction.appraisalItem.update({
            where: { id: reviewed.itemId },
            data: { points: reviewed.approvedPoints, notes: JSON.stringify(nextNotes) },
          });
        }

        await transaction.appraisal.update({
          where: { id: appraisalId },
          data: {
            status: "FULLY_APPROVED",
            finalScore: totalApproved,
            adminRemark: JSON.stringify({
              overallRemark: parsed.overallRemark?.trim() || null,
              reviewedBy: actorId,
              reviewedAt: new Date().toISOString(),
            }),
          },
        });
      });

      await writeAuditLog({
        actorId,
        action: "appraisal.admin.review.completed",
        resource: "Appraisal",
        resourceId: appraisalId,
        meta: { totalApproved },
      });

      res.json({
        success: true,
        message: "Appraisal forwarded to HR",
        data: { appraisalId, totalApprovedPoints: totalApproved, forwardedStatus: "HR_FINALIZED" },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Admin rejects appraisal
router.put(
  "/requests/:appraisalId/reject",
  authenticateRequest,
  requireRoles("MANAGEMENT", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorId = req.auth?.sub;
      if (!actorId) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      const { appraisalId } = req.params;
      const { reason } = adminRejectSchema.parse(req.body ?? {});

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        select: { id: true, status: true },
      });

      if (!appraisal) {
        res.status(404).json({ success: false, message: "Appraisal not found" });
        return;
      }

      if (appraisal.status !== "ADMIN_REVIEW") {
        res.status(400).json({ success: false, message: "Appraisal cannot be rejected at this stage" });
        return;
      }

      await prisma.appraisal.update({
        where: { id: appraisalId },
        data: { status: "REJECTED", rejectedAt: new Date(), rejectedBy: actorId, rejectionReason: reason.trim() },
      });

      await writeAuditLog({
        actorId,
        action: "appraisal.admin.rejected",
        resource: "Appraisal",
        resourceId: appraisalId,
        meta: { reason },
      });

      res.json({ success: true, message: "Appraisal rejected", data: { appraisalId, status: "REJECTED" } });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
