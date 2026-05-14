import express from "express";
import { z } from "zod";
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireRoles,
} from "../middleware/rbac";
import { prisma } from "../lib/prisma";
import {
  calculateHodScore,
  persistHodScore,
} from "../services/hodScoringService";
import { writeAuditLog } from "../lib/audit";

const router: express.Router = express.Router();

const hodReviewSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        approvedPoints: z.number().int().min(0),
        remark: z.string().optional(),
      }),
    )
    .min(1),
  additionalPoints: z.number().int().min(0).max(4).default(0),
  additionalPointsRemark: z.string().optional(),
  overallRemark: z.string().optional(),
});

function parseItemNotes(notes: string | null) {
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

function facultyIncrement(totalPoints: number) {
  if (totalPoints <= 12) {
    return 5;
  }
  if (totalPoints <= 20) {
    return 8;
  }
  if (totalPoints <= 30) {
    return 10;
  }
  return 15;
}

async function isHodForUser(hodId: string, departmentId: string | null) {
  if (!departmentId) {
    return false;
  }

  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      hodId,
    },
    select: { id: true },
  });

  return Boolean(department);
}

router.post(
  "/scoring/preview",
  authenticateRequest,
  requireRoles("HOD", "HR", "SUPER_ADMIN"),
  async (req, res, next) => {
    try {
      const result = await calculateHodScore(req.body ?? {});
      res.json({ success: true, message: "Preview generated", data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/appraisals/:appraisalId/score",
  authenticateRequest,
  requireRoles("HOD", "HR", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { appraisalId } = req.params;
      const { metrics, remarks } = req.body ?? {};
      const actorId = req.auth?.sub;

      if (!actorId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        select: {
          id: true,
          status: true,
          userId: true,
          user: { select: { departmentId: true } },
        },
      });

      if (!appraisal) {
        res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
        return;
      }

      if (!["SUBMITTED", "HOD_REVIEW"].includes(appraisal.status)) {
        res.status(400).json({
          success: false,
          message: "Appraisal is not ready for HOD scoring",
        });
        return;
      }

      const isHr =
        req.auth?.roles?.includes("HR") ||
        req.auth?.roles?.includes("SUPER_ADMIN");
      if (!isHr) {
        const hasDepartmentMatch = await isHodForUser(
          actorId,
          appraisal.user.departmentId ?? null,
        );
        if (!hasDepartmentMatch) {
          res.status(403).json({ success: false, message: "Access denied" });
          return;
        }
      }

      const result = await persistHodScore({
        appraisalId,
        actorId,
        remarks,
        metrics,
      });
      res.json({ success: true, message: "Appraisal scored", data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/requests",
  authenticateRequest,
  requireRoles("HOD", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const hodId = req.auth?.sub;
      if (!hodId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const dept = await prisma.department.findFirst({
        where: { hodId },
        select: { id: true, name: true },
      });

      if (!dept) {
        res.json({
          success: true,
          message: "No assigned department",
          data: [],
        });
        return;
      }

      const appraisals = await prisma.appraisal.findMany({
        where: {
          status: { in: ["SUBMITTED", "HOD_REVIEW"] },
          user: {
            departmentId: dept.id,
            id: { not: hodId },
            roles: { some: { role: "FACULTY" } },
          },
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
        message: "Faculty appraisal requests for HOD",
        data: payload,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/requests/:appraisalId",
  authenticateRequest,
  requireRoles("HOD", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const hodId = req.auth?.sub;
      if (!hodId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const { appraisalId } = req.params;
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
              roles: { select: { role: true } },
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
        },
      });

      if (!appraisal) {
        res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
        return;
      }

      if (appraisal.userId === hodId) {
        res.status(403).json({
          success: false,
          message: "Cannot review your own appraisal",
        });
        return;
      }

      const isFaculty = appraisal.user.roles.some(
        (role) => role.role === "FACULTY",
      );
      if (!isFaculty) {
        res.status(400).json({
          success: false,
          message: "Only faculty requests are reviewable here",
        });
        return;
      }

      const allowed = await isHodForUser(
        hodId,
        appraisal.user.departmentId ?? null,
      );
      if (!allowed && !req.auth?.roles?.includes("SUPER_ADMIN")) {
        res.status(403).json({ success: false, message: "Access denied" });
        return;
      }

      const items = appraisal.items.map((item) => {
        const parsed = parseItemNotes(item.notes);
        const hodReview =
          typeof parsed.hodReview === "object" && parsed.hodReview
            ? (parsed.hodReview as Record<string, unknown>)
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
          approvedPoints:
            typeof hodReview?.approvedPoints === "number"
              ? Number(hodReview.approvedPoints)
              : item.points,
          hodRemark:
            typeof hodReview?.remark === "string"
              ? String(hodReview.remark)
              : "",
          evidence:
            typeof parsed.evidence === "object" && parsed.evidence
              ? parsed.evidence
              : null,
        };
      });

      const hodRemarks = parseItemNotes(appraisal.hodRemarks);

      res.json({
        success: true,
        message: "Faculty appraisal request detail",
        data: {
          id: appraisal.id,
          status: appraisal.status,
          submittedAt: appraisal.submittedAt,
          user: appraisal.user,
          cycle: appraisal.cycle,
          items,
          additionalPoints:
            typeof hodRemarks.additionalPoints === "number"
              ? hodRemarks.additionalPoints
              : 0,
          additionalPointsRemark:
            typeof hodRemarks.additionalPointsRemark === "string"
              ? hodRemarks.additionalPointsRemark
              : "",
          overallRemark:
            typeof hodRemarks.overallRemark === "string"
              ? hodRemarks.overallRemark
              : "",
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/requests/:appraisalId/review",
  authenticateRequest,
  requireRoles("HOD", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const hodId = req.auth?.sub;
      if (!hodId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const { appraisalId } = req.params;
      const parsed = hodReviewSchema.parse(req.body ?? {});

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: {
          user: {
            select: {
              id: true,
              departmentId: true,
              roles: { select: { role: true } },
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
        },
      });

      if (!appraisal) {
        res
          .status(404)
          .json({ success: false, message: "Appraisal not found" });
        return;
      }

      if (!["SUBMITTED", "HOD_REVIEW"].includes(appraisal.status)) {
        res.status(400).json({
          success: false,
          message: "Only submitted requests can be reviewed",
        });
        return;
      }

      if (appraisal.userId === hodId) {
        res.status(403).json({
          success: false,
          message: "Cannot review your own appraisal",
        });
        return;
      }

      const isFaculty = appraisal.user.roles.some(
        (role) => role.role === "FACULTY",
      );
      if (!isFaculty) {
        res.status(400).json({
          success: false,
          message: "Target request is not a faculty appraisal",
        });
        return;
      }

      const allowed = await isHodForUser(
        hodId,
        appraisal.user.departmentId ?? null,
      );
      if (!allowed && !req.auth?.roles?.includes("SUPER_ADMIN")) {
        res.status(403).json({ success: false, message: "Access denied" });
        return;
      }

      if (parsed.items.length !== appraisal.items.length) {
        res.status(400).json({
          success: false,
          message: "Please review all criteria items before submitting",
        });
        return;
      }

      const byId = new Map(appraisal.items.map((item) => [item.id, item]));
      const hasDeduction = parsed.items.some((item) => {
        const existing = byId.get(item.itemId);
        return existing ? item.approvedPoints < existing.points : false;
      });

      if (
        parsed.additionalPoints > 0 &&
        !parsed.additionalPointsRemark?.trim()
      ) {
        res.status(400).json({
          success: false,
          message:
            "Additional points remark is required when extra points are granted",
        });
        return;
      }

      for (const reviewed of parsed.items) {
        const existing = byId.get(reviewed.itemId);
        if (!existing) {
          res.status(400).json({
            success: false,
            message: "Invalid item in review payload",
          });
          return;
        }

        if (reviewed.approvedPoints > existing.points) {
          res.status(400).json({
            success: false,
            message: "Approved points cannot exceed faculty selected points",
          });
          return;
        }

        if (
          reviewed.approvedPoints < existing.points &&
          !reviewed.remark?.trim()
        ) {
          res.status(400).json({
            success: false,
            message: "Remark is required for each deducted criterion",
          });
          return;
        }
      }

      const totalApproved =
        parsed.items.reduce((sum, item) => sum + item.approvedPoints, 0) +
        parsed.additionalPoints;
      const incrementPercent = facultyIncrement(totalApproved);

      await prisma.$transaction(async (transaction) => {
        for (const reviewed of parsed.items) {
          const existing = byId.get(reviewed.itemId);
          if (!existing) {
            continue;
          }

          const baseNotes = parseItemNotes(existing.notes);
          const nextNotes = {
            ...baseNotes,
            hodReview: {
              originalPoints: existing.points,
              approvedPoints: reviewed.approvedPoints,
              remark: reviewed.remark?.trim() || null,
              reviewedBy: hodId,
              reviewedAt: new Date().toISOString(),
            },
          };

          await transaction.appraisalItem.update({
            where: { id: reviewed.itemId },
            data: {
              points: reviewed.approvedPoints,
              notes: JSON.stringify(nextNotes),
            },
          });
        }

        const committees = await transaction.committee.findMany({
          select: { id: true },
        });

        if (committees.length > 0) {
          await transaction.committeeAssignment.deleteMany({
            where: { appraisalId },
          });

          await transaction.committeeAssignment.createMany({
            data: committees.map((committee) => ({
              committeeId: committee.id,
              appraisalId,
            })),
          });
        }

        await transaction.appraisal.update({
          where: { id: appraisalId },
          data: {
            status: "COMMITTEE_REVIEW",
            locked: true,
            finalScore: totalApproved,
            finalPercent: incrementPercent,
            hodRemarks: JSON.stringify({
              overallRemark: parsed.overallRemark?.trim() || null,
              additionalPoints: parsed.additionalPoints,
              additionalPointsRemark:
                parsed.additionalPointsRemark?.trim() || null,
              hasDeduction,
              reviewedBy: hodId,
              reviewedAt: new Date().toISOString(),
            }),
          },
        });
      });

      await writeAuditLog({
        actorId: hodId,
        action: "appraisal.hod.review.completed",
        resource: "Appraisal",
        resourceId: appraisalId,
        meta: {
          hasDeduction,
          additionalPoints: parsed.additionalPoints,
          totalApproved,
          incrementPercent,
        },
      });

      res.json({
        success: true,
        message: "Faculty appraisal reviewed successfully",
        data: {
          appraisalId,
          totalApprovedPoints: totalApproved,
          incrementPercent,
          forwardedStatus: "COMMITTEE_REVIEW",
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
// Committee review endpoints
const committeeReviewSchema = z.object({
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
  finalize: z.boolean().optional(),
});

router.get(
  "/committee/review-list",
  authenticateRequest,
  requireRoles("COMMITTEE", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const committeeId = req.auth?.sub;
      if (!committeeId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const committees = await prisma.committee.findMany({
        where: {
          members: {
            some: { id: committeeId },
          },
        },
        select: {
          id: true,
          assignments: {
            select: {
              appraisal: {
                select: {
                  id: true,
                  status: true,
                  submittedAt: true,
                  finalScore: true,
                  user: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                      department: { select: { id: true, name: true } },
                    },
                  },
                  cycle: {
                    select: {
                      id: true,
                      name: true,
                      startDate: true,
                      endDate: true,
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
                },
              },
            },
          },
        },
      });

      const appraisals = committees
        .flatMap((committee) =>
          committee.assignments.map((assignment) => assignment.appraisal),
        )
        .filter(
          (appraisal) =>
            appraisal.status === "COMMITTEE_REVIEW" ||
            appraisal.status === "HR_FINALIZED",
        );

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
        message: "Committee appraisal review list",
        data: payload,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/committee/requests/:appraisalId/review",
  authenticateRequest,
  requireRoles("COMMITTEE", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const committeeId = req.auth?.sub;
      if (!committeeId) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      const { appraisalId } = req.params;
      const parsed = committeeReviewSchema.parse(req.body ?? {});

      // Check if committee member is assigned to this appraisal
      const assignment = await prisma.committeeAssignment.findFirst({
        where: {
          appraisalId,
          committee: {
            members: {
              some: { id: committeeId },
            },
          },
        },
      });

      if (!assignment) {
        res.status(403).json({ success: false, message: "Access denied" });
        return;
      }

      const appraisal = await prisma.appraisal.findUnique({
        where: { id: appraisalId },
        include: {
          items: {
            select: {
              id: true,
              key: true,
              points: true,
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

      if (appraisal.status !== "COMMITTEE_REVIEW") {
        res.status(400).json({
          success: false,
          message: "Appraisal is not pending committee review",
        });
        return;
      }

      const isFinalSubmit = parsed.finalize ?? false;

      if (isFinalSubmit && parsed.items.length !== appraisal.items.length) {
        res.status(400).json({
          success: false,
          message: "Please review all criteria items before submitting",
        });
        return;
      }

      const byId = new Map(appraisal.items.map((item) => [item.id, item]));

      // Validate all items have remarks if marks are deducted
      for (const reviewed of parsed.items) {
        const existing = byId.get(reviewed.itemId);
        if (!existing) {
          res.status(400).json({
            success: false,
            message: "Invalid item in review payload",
          });
          return;
        }

        // Parse existing to get HOD-approved points
        let hodApprovedPoints = existing.points;
        if (existing.notes) {
          try {
            const itemParsed = JSON.parse(existing.notes);
            if (typeof itemParsed.hodReview?.approvedPoints === "number") {
              hodApprovedPoints = itemParsed.hodReview.approvedPoints;
            }
          } catch {
            // best effort
          }
        }

        if (reviewed.approvedPoints > hodApprovedPoints) {
          res.status(400).json({
            success: false,
            message:
              "Committee approved points cannot exceed HOD approved points",
          });
          return;
        }

        if (
          reviewed.approvedPoints < hodApprovedPoints &&
          !reviewed.remark?.trim()
        ) {
          res.status(400).json({
            success: false,
            message: "Remark is required for each deducted criterion",
          });
          return;
        }
      }

      const totalApproved = parsed.items.reduce(
        (sum, item) => sum + item.approvedPoints,
        0,
      );

      await prisma.$transaction(async (transaction) => {
        for (const reviewed of parsed.items) {
          const existing = byId.get(reviewed.itemId);
          if (!existing) {
            continue;
          }

          const baseNotes = parseItemNotes(existing.notes);
          const nextNotes = {
            ...baseNotes,
            committeeReview: {
              approvedPoints: reviewed.approvedPoints,
              remark: reviewed.remark?.trim() || null,
              reviewedBy: committeeId,
              reviewedAt: new Date().toISOString(),
            },
          };

          await transaction.appraisalItem.update({
            where: { id: reviewed.itemId },
            data: {
              points: reviewed.approvedPoints,
              notes: JSON.stringify(nextNotes),
            },
          });
        }

        if (isFinalSubmit) {
          await transaction.appraisal.update({
            where: { id: appraisalId },
            data: {
              status: "HR_FINALIZED",
              finalScore: totalApproved,
              committeeNotes: JSON.stringify({
                overallRemark: parsed.overallRemark?.trim() || null,
                reviewedBy: committeeId,
                reviewedAt: new Date().toISOString(),
              }),
            },
          });
        }
      });

      await writeAuditLog({
        actorId: committeeId,
        action: isFinalSubmit
          ? "appraisal.committee.review.completed"
          : "appraisal.committee.review.saved",
        resource: "Appraisal",
        resourceId: appraisalId,
        meta: {
          totalApproved,
          finalize: isFinalSubmit,
          savedItems: parsed.items.length,
        },
      });

      res.json({
        success: true,
        message: isFinalSubmit
          ? "Appraisal reviewed successfully"
          : "Committee section saved successfully",
        data: {
          appraisalId,
          totalApprovedPoints: totalApproved,
          forwardedStatus: isFinalSubmit ? "HR_FINALIZED" : "COMMITTEE_REVIEW",
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
