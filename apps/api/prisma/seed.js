import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@svgoi.local';
    const adminPass = process.env.ADMIN_PASS || 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(adminPass, 10);
    const dept = await prisma.department.upsert({
        where: { name: 'Computer Science' },
        update: {},
        create: { name: 'Computer Science', code: 'CSE' }
    });
    const user = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            passwordHash,
            firstName: 'System',
            lastName: 'Admin',
            departmentId: dept.id
        }
    });
    await prisma.userRole.create({ data: { userId: user.id, role: 'SUPER_ADMIN' } });
    console.log('Seed completed');
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
