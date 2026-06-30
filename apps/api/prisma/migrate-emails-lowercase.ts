import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });

  let updated = 0;
  for (const user of users) {
    const lower = user.email.toLowerCase();
    if (lower !== user.email) {
      await prisma.user.update({ where: { id: user.id }, data: { email: lower } });
      console.log(`  ${user.email} → ${lower}`);
      updated++;
    }
  }

  console.log(`\nDone. ${updated} of ${users.length} emails updated.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
