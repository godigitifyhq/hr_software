import { prisma } from "../src/lib/prisma";

async function deleteAppraisalForFaculty() {
  try {
    // Find the user with email faculty@svgoi.local
    const user = await prisma.user.findUnique({
      where: { email: "faculty@svgoi.local" },
    });

    if (!user) {
      console.log("User faculty@svgoi.local not found");
      return;
    }

    console.log(
      `Found user: ${user.firstName} ${user.lastName} (ID: ${user.id})`,
    );

    // Find all appraisals for this user
    const appraisals = await prisma.appraisal.findMany({
      where: { userId: user.id },
      include: {
        cycle: { select: { name: true } },
      },
    });

    console.log(`Found ${appraisals.length} appraisal(s):`);
    appraisals.forEach((a) => {
      console.log(
        `  - ${a.cycle?.name || "Unknown Cycle"} (ID: ${a.id}, Status: ${
          a.status
        })`,
      );
    });

    if (appraisals.length === 0) {
      console.log("No appraisals to delete");
      return;
    }

    // Delete all appraisal items first (foreign key constraint)
    for (const appraisal of appraisals) {
      await prisma.appraisalItem.deleteMany({
        where: { appraisalId: appraisal.id },
      });
      console.log(`Deleted appraisal items for ${appraisal.id}`);

      // Delete committee assignments
      await prisma.committeeAssignment.deleteMany({
        where: { appraisalId: appraisal.id },
      });
      console.log(`Deleted committee assignments for ${appraisal.id}`);

      // Delete the appraisal
      await prisma.appraisal.delete({
        where: { id: appraisal.id },
      });
      console.log(`Deleted appraisal ${appraisal.id}`);
    }

    console.log(
      `✅ Successfully deleted ${appraisals.length} appraisal(s) for faculty@svgoi.local`,
    );
  } catch (error) {
    console.error("Error deleting appraisal:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAppraisalForFaculty();
