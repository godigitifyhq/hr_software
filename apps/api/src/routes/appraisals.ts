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

const appraisalUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        key: z.string().min(1),
        points: z.number().int().min(0).max(4),
        weight: z.number().min(0),
        notes: z.string().optional(),
      }),
    )
    .min(1),
});

const committeeReviewSchema = z.object({
  notes: z.string().min(1),
});

type AppraisalItemInput = {
  id?: string;
  key: string;
  points: number;
  weight: number;
  notes?: string | null;
};

function computeFinalScores(items: AppraisalItemInput[]) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) {
    return { finalScore: 0, finalPercent: 0 };
  }

  const weightedAverage =
    items.reduce((sum, item) => sum + item.points * item.weight, 0) /
    totalWeight;

  return {
    finalScore: Number(weightedAverage.toFixed(2)),
    finalPercent: Number(((weightedAverage / 4) * 100).toFixed(1)),
  };
}

async function getAppraisalOr404(appraisalId: string) {
  return prisma.appraisal.findUnique({
    where: { id: appraisalId },
    include: {
      cycle: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          departmentId: true,
        },
      },
      items: true,
      committeeAssignments: {
        include: {
          committee: {
            include: {
              members: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });
}

async function canViewAppraisal(
  appraisal: NonNullable<Awaited<ReturnType<typeof getAppraisalOr404>>>,
  userId: string,
  roles: string[],
) {
  if (
    appraisal.userId === userId ||
    roles.includes("HR") ||
    roles.includes("SUPER_ADMIN")
  ) {
    return true;
  }

  if (roles.includes("HOD") && appraisal.user.departmentId) {
    const hodDepartment = await prisma.department.findFirst({
      where: {
        hodId: userId,
        id: appraisal.user.departmentId,
      },
      select: { id: true },
    });

    if (hodDepartment) {
      return true;
    }
  }

  if (roles.includes("COMMITTEE")) {
    if (["COMMITTEE_REVIEW", "HR_FINALIZED"].includes(appraisal.status)) {
      return true;
    }

    return appraisal.committeeAssignments.some((assignment) =>
      assignment.committee.members.some((member) => member.id === userId),
    );
  }

  return false;
}

router.get(
  "/hr/dashboard",
  authenticateRequest,
  requireRoles("HR", "SUPER_ADMIN"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const appraisals = await prisma.appraisal.findMany({
        include: {
          cycle: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              isActive: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
      });

      const byStatus: Record<string, typeof appraisals> = {};
      appraisals.forEach((appraisal) => {
        if (!byStatus[appraisal.status]) {
          byStatus[appraisal.status] = [];
        }
        byStatus[appraisal.status].push(appraisal);
      });

      res.json({
        success: true,
        message: "All appraisals for HR dashboard",
        data: { all: appraisals, byStatus },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/hod/review-list",
  authenticateRequest,
  requireRoles("HOD", "HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const hodId = req.auth?.sub;

      if (!hodId) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      const departments = await prisma.department.findMany({
        where: { hodId },
      });

      const deptIds = departments.map((department) => department.id);

      const appraisals = await prisma.appraisal.findMany({
        where: {
          status: { in: ["SUBMITTED", "HOD_REVIEW"] },
          user: {
            departmentId: { in: deptIds },
            id: { not: hodId },
          },
        },
        include: {
          cycle: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              isActive: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      });

      res.json({
        success: true,
        message: "Appraisals for HOD review retrieved",
        data: appraisals,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/committee/review-list",
  authenticateRequest,
  requireRoles("COMMITTEE", "HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      const committeeIds = await prisma.committee
        .findMany({
          where: {
            members: {
              some: { id: userId },
            },
          },
          select: { id: true },
        })
        .then((committees) => committees.map((committee) => committee.id));

      const appraisals = await prisma.appraisal.findMany({
        where: {
          status: { in: ["HOD_REVIEW", "COMMITTEE_REVIEW"] },
          OR: [
            {
              committeeAssignments: {
                some: {
                  committeeId: { in: committeeIds },
                },
              },
            },
            {
              AND: [
                { status: "COMMITTEE_REVIEW" },
                {
                  committeeAssignments: {
                    none: {},
                  },
                },
              ],
            },
          ],
        },
        include: {
          cycle: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              isActive: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              department: { select: { id: true, name: true } },
            },
          },
          items: {
            select: {
              id: true,
              key: true,
              points: true,
              notes: true,
            },
          },
          committeeAssignments: {
            select: { committeeId: true },
          },
        },
        orderBy: { submittedAt: "desc" },
      });

      const payload = appraisals.map((appraisal) => ({
        id: appraisal.id,
        status: appraisal.status,
        submittedAt: appraisal.submittedAt,
        finalScore: appraisal.finalScore,
        user: appraisal.user,
        cycle: appraisal.cycle,
        totalSelectedPoints: appraisal.items.reduce(
          (sum, item) => sum + item.points,
          0,
        ),
        itemsCount: appraisal.items.length,
      }));

      res.json({
        success: true,
        message: "Appraisals for committee review retrieved",
        data: payload,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/",
  authenticateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      console.log("[Appraisals API] GET /appraisals", {
        auth: { sub: req.auth?.sub, roles: req.auth?.roles },
      });

      if (!req.auth?.sub) {
        console.log("[Appraisals API] No auth.sub in request");
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      const appraisals = await prisma.appraisal.findMany({
        where: { userId: req.auth.sub },
        include: {
          cycle: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      console.log("[Appraisals API] Found", appraisals.length, "appraisals");

      res.json({
        success: true,
        message: "Appraisals retrieved",
        data: appraisals,
      });
    } catch (error) {
      console.error("[Appraisals API] Error:", error);
      next(error);
    }
  },
);

router.put(
  "/:appraisalId",
  authenticateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { appraisalId } = req.params;
      const userId = req.auth?.sub;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      const parsed = appraisalUpdateSchema.parse(req.body);
      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
      });

      if (!appraisal) {
        return res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
      }

      if (appraisal.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Can only edit your own appraisal",
        });
      }

      if (appraisal.status !== "DRAFT" || appraisal.locked) {
        return res.status(400).json({
          success: false,
          message: "Only unlocked draft appraisals can be edited",
        });
      }

      const existingItemIds = parsed.items
        .filter((item) => item.id)
        .map((item) => item.id as string);

      if (existingItemIds.length > 0) {
        const ownedItems = await prisma.appraisalItem.findMany({
          where: {
            appraisalId,
            id: { in: existingItemIds },
          },
          select: { id: true },
        });

        if (ownedItems.length !== existingItemIds.length) {
          return res.status(400).json({
            success: false,
            message: "One or more appraisal items are invalid",
          });
        }
      }

      const { finalScore, finalPercent } = computeFinalScores(parsed.items);

      await prisma.$transaction(async (transaction) => {
        await transaction.appraisalItem.deleteMany({ where: { appraisalId } });

        await transaction.appraisalItem.createMany({
          data: parsed.items.map((item) => ({
            appraisalId,
            key: item.key,
            points: item.points,
            weight: item.weight,
            notes: item.notes || null,
          })),
        });

        await transaction.appraisal.update({
          where: { id: appraisalId },
          data: {
            finalScore,
            finalPercent,
            locked: false,
          },
        });
      });

      const updated = await getAppraisalOr404(appraisalId);

      res.json({
        success: true,
        message: "Appraisal updated successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:appraisalId",
  authenticateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { appraisalId } = req.params;
      const userId = req.auth?.sub;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      const appraisal = await getAppraisalOr404(appraisalId);

      if (!appraisal) {
        return res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
      }

      const roles = req.auth?.roles || [];
      const canView = await canViewAppraisal(appraisal, userId, roles);

      if (!canView) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      res.json({
        success: true,
        message: "Appraisal retrieved",
        data: appraisal,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:appraisalId/committee-review",
  authenticateRequest,
  requireRoles("COMMITTEE", "HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { appraisalId } = req.params;
      const userId = req.auth?.sub;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      const parsed = committeeReviewSchema.parse(req.body);
      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: {
          committeeAssignments: {
            include: {
              committee: {
                include: { members: { select: { id: true } } },
              },
            },
          },
        },
      });

      if (!appraisal) {
        return res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
      }

      const isHr =
        req.auth?.roles?.includes("HR") ||
        req.auth?.roles?.includes("SUPER_ADMIN");
      const isAssignedCommitteeMember = appraisal.committeeAssignments.some(
        (assignment) =>
          assignment.committee.members.some((member) => member.id === userId),
      );

      if (!isHr && !isAssignedCommitteeMember) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      if (!["HOD_REVIEW", "COMMITTEE_REVIEW"].includes(appraisal.status)) {
        return res.status(400).json({
          success: false,
          message: "Appraisal is not ready for committee review",
        });
      }

      const updated = await prisma.appraisal.update({
        where: { id: appraisalId },
        data: {
          committeeNotes: parsed.notes.trim(),
          status: "HR_FINALIZED",
          locked: true,
        },
        include: {
          cycle: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              departmentId: true,
            },
          },
          items: true,
          committeeAssignments: {
            include: {
              committee: {
                include: {
                  members: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      });

      await writeAuditLog({
        actorId: userId,
        action: "appraisal.committee.review.finalized",
        resource: "Appraisal",
        resourceId: updated.id,
        meta: { notes: parsed.notes.trim() },
      });

      res.json({
        success: true,
        message: "Committee review saved successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:appraisalId/submit",
  authenticateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { appraisalId } = req.params;
      const userId = req.auth?.sub;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: { items: true },
      });

      if (!appraisal) {
        return res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
      }

      if (appraisal.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Can only submit your own appraisal",
        });
      }

      if (appraisal.status !== "DRAFT") {
        return res.status(400).json({
          success: false,
          message: `Cannot submit appraisal in ${appraisal.status} status`,
        });
      }

      if (appraisal.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Appraisal must contain at least one item before submission",
        });
      }

      const { finalScore, finalPercent } = computeFinalScores(appraisal.items);

      const updated = await prisma.appraisal.update({
        where: { id: appraisalId },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          locked: true,
          finalScore,
          finalPercent,
        },
        include: {
          cycle: true,
          items: true,
        },
      });

      res.json({
        success: true,
        message: "Appraisal submitted successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
