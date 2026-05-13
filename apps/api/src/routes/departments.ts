import express from "express";
import { prisma } from "../lib/prisma";

const router: express.Router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      message: "Departments retrieved",
      data: departments,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
