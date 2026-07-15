import express from "express";
import { z } from "zod";
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireRoles,
} from "../middleware/rbac";
import { AppraisalCategory, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "../lib/audit";
import {
  ALL_CATEGORIES,
  categoryForKey,
  categoryForRoles,
  labelForCategory,
} from "../lib/appraisalCategories";
import {
  allCategoriesApproved,
  ensureCategoryApprovals,
} from "../lib/categoryApprovals";

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

const categoryReviewSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        approvedPoints: z.number().int().min(0),
        remark: z.string().optional(),
      }),
    )
    .min(1),
  notes: z.string().optional(),
  // SUPER_ADMIN (which holds no category role) must name the category it acts on.
  category: z.enum(["ACADEMICS", "RESEARCH", "OTHERS"]).optional(),
});

function readHodApprovedPoints(notes: string | null, fallback: number): number {
  if (!notes) return fallback;
  try {
    const parsed = JSON.parse(notes) as {
      hodReview?: { approvedPoints?: number };
    };
    return typeof parsed.hodReview?.approvedPoints === "number"
      ? parsed.hodReview.approvedPoints
      : fallback;
  } catch {
    return fallback;
  }
}

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
      categoryApprovals: {
        include: {
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
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

  if (isAnyCommittee(roles)) {
    if (["COMMITTEE_REVIEW", "HR_FINALIZED"].includes(appraisal.status)) {
      return true;
    }

    return appraisal.committeeAssignments.some((assignment) =>
      assignment.committee.members.some((member) => member.id === userId),
    );
  }

  return false;
}

const COMMITTEE_ROLES = [
  "COMMITTEE",
  "COMMITTEE_ACADEMIC",
  "COMMITTEE_RESEARCH",
  "COMMITTEE_OTHER",
];

function isAnyCommittee(roles: string[]): boolean {
  return roles.some((role) => COMMITTEE_ROLES.includes(role));
}

function facultyIncrement(totalPoints: number) {
  if (totalPoints < 16) return 5;
  if (totalPoints < 30) return 8;
  if (totalPoints < 45) return 10;
  return 15;
}

function parseHodAdditionalPoints(hodRemarks: string | null): number {
  if (!hodRemarks) return 0;
  try {
    const parsed = JSON.parse(hodRemarks);
    return typeof parsed.additionalPoints === "number" ? parsed.additionalPoints : 0;
  } catch {
    return 0;
  }
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

      const appraisals = await prisma.appraisal.findMany({
        where: {
          status: { in: ["SUBMITTED", "HOD_REVIEW"] },
          user: {
            id: { not: hodId },
            department: { hodId },
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
  "/cycles",
  authenticateRequest,
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const cycles = await prisma.appraisalCycle.findMany({
        select: { id: true, name: true, startDate: true, endDate: true, isActive: true },
        orderBy: { startDate: "desc" },
      });
      res.json({ success: true, message: "Cycles", data: cycles });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/committee/review-list",
  authenticateRequest,
  requireRoles(
    "COMMITTEE",
    "COMMITTEE_ACADEMIC",
    "COMMITTEE_RESEARCH",
    "COMMITTEE_OTHER",
    "HR",
    "SUPER_ADMIN",
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      // The category this caller governs (null for legacy COMMITTEE / HR).
      const callerCategory = categoryForRoles(req.auth?.roles);

      const committeeCycleParam =
        typeof req.query.cycleId === "string" ? req.query.cycleId : null;

      let committeeCycleId: string | null = null;
      if (committeeCycleParam && committeeCycleParam !== "all") {
        committeeCycleId = committeeCycleParam;
      } else if (!committeeCycleParam) {
        const activeCycle = await prisma.appraisalCycle.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        committeeCycleId = activeCycle?.id ?? null;
      }

      const appraisals = await prisma.appraisal.findMany({
        where: {
          ...(committeeCycleId ? { cycleId: committeeCycleId } : {}),
          status: { in: ["HOD_REVIEW", "COMMITTEE_REVIEW", "HR_FINALIZED", "FULLY_APPROVED"] },
          // Category committees (Academic/Research/Other) review by role, not by
          // committee assignment — every appraisal in these statuses has items
          // in their category, so show them all. Legacy COMMITTEE / HR keep the
          // assignment-based visibility rules.
          ...(callerCategory
            ? {}
            : {
                OR: [
                  {
                    committeeAssignments: {
                      some: {
                        committee: { members: { some: { id: userId } } },
                      },
                    },
                  },
                  {
                    AND: [
                      { status: { in: ["COMMITTEE_REVIEW", "HR_FINALIZED", "FULLY_APPROVED"] } },
                      {
                        committeeAssignments: {
                          none: {},
                        },
                      },
                    ],
                  },
                ],
              }),
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          finalScore: true,
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
              points: true,
              category: true,
            },
          },
          categoryApprovals: {
            select: { category: true, approved: true },
          },
        },
        orderBy: { submittedAt: "desc" },
      });

      // Note: we do NOT create approval rows here. On a list endpoint that
      // would mean many parallel writes (one per appraisal) and can exhaust the
      // DB connection pool. Appraisals without rows yet correctly render as
      // "pending" below; the rows are materialised lazily when a committee opens
      // the appraisal (GET /:id) or approves a category.
      const payload = appraisals.map((appraisal) => {
        // Points visible to this caller: only their category when they hold a
        // category committee role, otherwise the whole appraisal (legacy/HR).
        const scopedItems = callerCategory
          ? appraisal.items.filter((item) => item.category === callerCategory)
          : appraisal.items;

        const approvalByCategory = new Map(
          appraisal.categoryApprovals.map((a) => [a.category, a.approved]),
        );

        return {
          id: appraisal.id,
          status: appraisal.status,
          submittedAt: appraisal.submittedAt,
          finalScore: appraisal.finalScore,
          user: appraisal.user,
          cycle: appraisal.cycle,
          totalSelectedPoints: scopedItems.reduce(
            (sum, item) => sum + item.points,
            0,
          ),
          itemsCount: scopedItems.length,
          callerCategory,
          categoryApprovals: ALL_CATEGORIES.map((category) => ({
            category,
            label: labelForCategory(category),
            approved: approvalByCategory.get(category) ?? false,
          })),
        };
      });

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
      if (!req.auth?.sub) {
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

      res.json({
        success: true,
        message: "Appraisals retrieved",
        data: appraisals,
      });
    } catch (error) {
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
            category: categoryForKey(item.key),
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

      let appraisal = await getAppraisalOr404(appraisalId);

      if (!appraisal) {
        return res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
      }

      // Lazily materialise the three per-category approval rows the first time
      // an appraisal is opened during committee review, so the UI always has a
      // complete status board (Academic / Research / Other).
      if (
        appraisal.status === "COMMITTEE_REVIEW" &&
        appraisal.categoryApprovals.length < ALL_CATEGORIES.length
      ) {
        await ensureCategoryApprovals(appraisalId);
        appraisal = (await getAppraisalOr404(appraisalId)) ?? appraisal;
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
      // Selects firstName/lastName up front (not just id) so this same fetch
      // can also supply the committeeAssignments block of the response below,
      // instead of the update() call re-fetching the identical relation.
      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: {
          committeeAssignments: {
            include: {
              committee: {
                include: {
                  members: { select: { id: true, firstName: true, lastName: true } },
                },
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
      const isCommittee = req.auth?.roles?.includes("COMMITTEE") ?? false;
      const hasNoAssignment = appraisal.committeeAssignments.length === 0;
      const isAssignedCommitteeMember = appraisal.committeeAssignments.some(
        (assignment) =>
          assignment.committee.members.some((member) => member.id === userId),
      );

      // Allow: HR/super-admin, assigned committee members, or any committee
      // member when the appraisal has no specific committee assignment.
      if (!isHr && !isAssignedCommitteeMember && !(isCommittee && hasNoAssignment)) {
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

      // committeeAssignments already fetched above and unchanged by this
      // update, so it's attached from there instead of being included (and
      // refetched) again here. The audit write's fields don't depend on the
      // update's result (resourceId is just appraisalId either way), so it
      // runs concurrently instead of after.
      const [updated] = await Promise.all([
        prisma.appraisal.update({
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
          },
        }),
        writeAuditLog({
          actorId: userId,
          action: "appraisal.committee.review.finalized",
          resource: "Appraisal",
          resourceId: appraisalId,
          meta: { notes: parsed.notes.trim() },
        }),
      ]);

      res.json({
        success: true,
        message: "Committee review saved successfully",
        data: { ...updated, committeeAssignments: appraisal.committeeAssignments },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Per-category committee approval (Task 2). Each of the three category
// committees (Academic / Research / Other) reviews only its own criteria and
// approves that category. The appraisal auto-combines and advances to HR only
// once all three categories are approved.
router.put(
  "/:appraisalId/category-review",
  authenticateRequest,
  requireRoles(
    "COMMITTEE_ACADEMIC",
    "COMMITTEE_RESEARCH",
    "COMMITTEE_OTHER",
    "SUPER_ADMIN",
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      const { appraisalId } = req.params;
      const parsed = categoryReviewSchema.parse(req.body ?? {});

      const category =
        categoryForRoles(req.auth?.roles) ??
        (parsed.category as AppraisalCategory | undefined) ??
        null;
      if (!category) {
        return res.status(400).json({
          success: false,
          message: "No committee category resolved for this reviewer",
        });
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

      if (appraisal.status !== "COMMITTEE_REVIEW") {
        return res.status(400).json({
          success: false,
          message: "Appraisal is not pending committee review",
        });
      }

      await ensureCategoryApprovals(appraisalId);

      // Only this category's items are reviewable here, and all of them must be
      // reviewed to approve the category.
      const categoryItems = appraisal.items.filter(
        (item) => item.category === category,
      );
      const categoryItemIds = new Set(categoryItems.map((item) => item.id));
      const submittedIds = new Set(parsed.items.map((item) => item.itemId));

      for (const submitted of parsed.items) {
        if (!categoryItemIds.has(submitted.itemId)) {
          return res.status(400).json({
            success: false,
            message: "Item does not belong to this reviewer's category",
          });
        }
      }
      if (
        categoryItems.length > 0 &&
        submittedIds.size !== categoryItemIds.size
      ) {
        return res.status(400).json({
          success: false,
          message: "Please review all criteria in your category before approving",
        });
      }

      const byId = new Map(appraisal.items.map((item) => [item.id, item]));
      for (const reviewed of parsed.items) {
        const existing = byId.get(reviewed.itemId)!;
        const upper = readHodApprovedPoints(existing.notes, existing.points);
        if (reviewed.approvedPoints > upper) {
          return res.status(400).json({
            success: false,
            message: "Approved points cannot exceed HOD approved points",
          });
        }
        if (reviewed.approvedPoints < upper && !reviewed.remark?.trim()) {
          return res.status(400).json({
            success: false,
            message: "Remark is required for each deducted criterion",
          });
        }
      }

      // Persist per-item committee decision (points + committeeReview note).
      const reviewedAt = new Date().toISOString();
      const updateRows = parsed.items
        .map((reviewed) => {
          const existing = byId.get(reviewed.itemId);
          if (!existing) return null;
          const baseNotes = (() => {
            if (!existing.notes) return {} as Record<string, unknown>;
            try {
              return JSON.parse(existing.notes) as Record<string, unknown>;
            } catch {
              return {} as Record<string, unknown>;
            }
          })();
          const nextNotes = {
            ...baseNotes,
            committeeReview: {
              approvedPoints: reviewed.approvedPoints,
              remark: reviewed.remark?.trim() || null,
              reviewedBy: userId,
              reviewedAt,
            },
          };
          return Prisma.sql`(${reviewed.itemId}::text, ${reviewed.approvedPoints}::int, ${JSON.stringify(nextNotes)}::text)`;
        })
        .filter((row): row is Prisma.Sql => row !== null);

      if (updateRows.length > 0) {
        await prisma.$executeRaw`
          UPDATE "AppraisalItem" AS ai
          SET points = v.points, notes = v.notes
          FROM (VALUES ${Prisma.join(updateRows)}) AS v(id, points, notes)
          WHERE ai.id = v.id
        `;
      }

      const categoryTotal = parsed.items.reduce(
        (sum, item) => sum + item.approvedPoints,
        0,
      );

      await prisma.categoryApproval.update({
        where: { appraisalId_category: { appraisalId, category } },
        data: {
          approved: true,
          approvedById: userId,
          approvedAt: new Date(),
          notes: parsed.notes?.trim() || null,
          totalPoints: categoryTotal,
        },
      });

      // Gate: advance to HR only once all three categories are approved.
      const approvals = await prisma.categoryApproval.findMany({
        where: { appraisalId },
        select: { category: true, approved: true },
      });
      const combined = allCategoriesApproved(approvals);

      let forwardedStatus = appraisal.status as string;
      if (combined) {
        const freshItems = await prisma.appraisalItem.findMany({
          where: { appraisalId },
          select: { points: true },
        });
        const itemTotal = freshItems.reduce((sum, i) => sum + i.points, 0);
        const totalApproved =
          itemTotal + parseHodAdditionalPoints(appraisal.hodRemarks);
        await prisma.appraisal.update({
          where: { id: appraisalId },
          data: {
            status: "HR_FINALIZED",
            locked: true,
            finalScore: totalApproved,
            finalPercent: facultyIncrement(totalApproved),
          },
        });
        forwardedStatus = "HR_FINALIZED";
      }

      await writeAuditLog({
        actorId: userId,
        action: combined
          ? "appraisal.committee.category.approved.combined"
          : "appraisal.committee.category.approved",
        resource: "Appraisal",
        resourceId: appraisalId,
        meta: { category, categoryTotal, combined },
      });

      res.json({
        success: true,
        message: combined
          ? "Category approved. All categories complete — forwarded to HR."
          : `${labelForCategory(category)} category approved.`,
        data: {
          appraisalId,
          category,
          categoryTotal,
          combined,
          status: forwardedStatus,
          categoryApprovals: ALL_CATEGORIES.map((c) => ({
            category: c,
            label: labelForCategory(c),
            approved: approvals.some((a) => a.category === c && a.approved),
          })),
        },
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

      // Items aren't modified by this handler, so the ones already fetched
      // above are reused instead of being included (and refetched) again here.
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
        },
      });

      res.json({
        success: true,
        message: "Appraisal submitted successfully",
        data: { ...updated, items: appraisal.items },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
