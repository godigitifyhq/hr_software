import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertUser(email: string, data: Parameters<typeof prisma.user.upsert>[0]['create']) {
    return prisma.user.upsert({
        where: { email },
        update: {
            firstName: data.firstName,
            lastName: data.lastName,
            departmentId: data.departmentId,
            passwordHash: data.passwordHash
        },
        create: data
    });
}

async function findOrCreateCycle(name: string, startDate: Date, endDate: Date, isActive: boolean) {
    const existing = await prisma.appraisalCycle.findFirst({ where: { name } });

    if (existing) {
        return prisma.appraisalCycle.update({
            where: { id: existing.id },
            data: { startDate, endDate, isActive }
        });
    }

    return prisma.appraisalCycle.create({
        data: { name, startDate, endDate, isActive }
    });
}

async function findOrCreateCommittee(name: string, memberIds: string[]) {
    const existing = await prisma.committee.findFirst({ where: { name } });

    if (existing) {
        return prisma.committee.update({
            where: { id: existing.id },
            data: {
                members: {
                    set: memberIds.map(id => ({ id }))
                }
            }
        });
    }

    return prisma.committee.create({
        data: {
            name,
            members: {
                connect: memberIds.map(id => ({ id }))
            }
        }
    });
}

async function upsertAppraisal(params: {
    cycleId: string;
    userId: string;
    status: 'DRAFT' | 'SUBMITTED' | 'HOD_REVIEW' | 'COMMITTEE_REVIEW' | 'HR_FINALIZED' | 'CLOSED';
    submittedAt?: Date;
    locked?: boolean;
    finalScore?: number;
    finalPercent?: number;
    hodRemarks?: string;
    committeeNotes?: string;
    items: Array<{ key: string; points: number; weight: number; notes?: string }>;
}) {
    const existing = await prisma.appraisal.findFirst({
        where: { cycleId: params.cycleId, userId: params.userId }
    });

    const appraisal = existing
        ? await prisma.appraisal.update({
            where: { id: existing.id },
            data: {
                cycleId: params.cycleId,
                userId: params.userId,
                status: params.status,
                submittedAt: params.submittedAt,
                locked: params.locked ?? false,
                finalScore: params.finalScore,
                finalPercent: params.finalPercent,
                hodRemarks: params.hodRemarks,
                committeeNotes: params.committeeNotes
            }
        })
        : await prisma.appraisal.create({
            data: {
                cycleId: params.cycleId,
                userId: params.userId,
                status: params.status,
                submittedAt: params.submittedAt,
                locked: params.locked ?? false,
                finalScore: params.finalScore,
                finalPercent: params.finalPercent,
                hodRemarks: params.hodRemarks,
                committeeNotes: params.committeeNotes
            }
        });

    await prisma.appraisalItem.deleteMany({ where: { appraisalId: appraisal.id } });

    await prisma.appraisalItem.createMany({
        data: params.items.map(item => ({
            appraisalId: appraisal.id,
            key: item.key,
            points: item.points,
            weight: item.weight,
            notes: item.notes || null
        }))
    });

    return appraisal;
}

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@svgoi.local';
    const adminPass = process.env.ADMIN_PASS || 'ChangeMe123!';
    const commonPassword = process.env.TEST_USER_PASS || 'ChangeMe123!';

    const passwordHash = await bcrypt.hash(adminPass, 10);
    const testPasswordHash = await bcrypt.hash(commonPassword, 10);

    const csDept = await prisma.department.upsert({
        where: { name: 'Computer Science' },
        update: {},
        create: { name: 'Computer Science', code: 'CSE' }
    });

    const eceDept = await prisma.department.upsert({
        where: { name: 'Electronics and Communication' },
        update: {},
        create: { name: 'Electronics and Communication', code: 'ECE' }
    });

    const admin = await upsertUser(adminEmail, {
        email: adminEmail,
        passwordHash,
        firstName: 'System',
        lastName: 'Admin',
        departmentId: csDept.id
    });

    const hrUser = await upsertUser('hr@svgoi.local', {
        email: 'hr@svgoi.local',
        passwordHash: testPasswordHash,
        firstName: 'Harini',
        lastName: 'Rao',
        departmentId: csDept.id
    });

    const hodUser = await upsertUser('hod@svgoi.local', {
        email: 'hod@svgoi.local',
        passwordHash: testPasswordHash,
        firstName: 'Nikhil',
        lastName: 'Sharma',
        departmentId: csDept.id
    });

    const committeeUser = await upsertUser('committee@svgoi.local', {
        email: 'committee@svgoi.local',
        passwordHash: testPasswordHash,
        firstName: 'Meera',
        lastName: 'Iyer',
        departmentId: eceDept.id
    });

    const draftUser = await upsertUser('draft.faculty@svgoi.local', {
        email: 'draft.faculty@svgoi.local',
        passwordHash: testPasswordHash,
        firstName: 'Priya',
        lastName: 'Nair',
        departmentId: csDept.id
    });

    const submittedUser = await upsertUser('submitted.employee@svgoi.local', {
        email: 'submitted.employee@svgoi.local',
        passwordHash: testPasswordHash,
        firstName: 'Karan',
        lastName: 'Mehta',
        departmentId: eceDept.id
    });

    const facultyUser = await upsertUser('faculty@svgoi.local', {
        email: 'faculty@svgoi.local',
        passwordHash: testPasswordHash,
        firstName: 'Ananya',
        lastName: 'Patel',
        departmentId: csDept.id
    });

    const employeeUser = await upsertUser('employee@svgoi.local', {
        email: 'employee@svgoi.local',
        passwordHash: testPasswordHash,
        firstName: 'Rahul',
        lastName: 'Verma',
        departmentId: eceDept.id
    });

    await prisma.userRole.deleteMany({
        where: { userId: { in: [admin.id, hrUser.id, hodUser.id, committeeUser.id, draftUser.id, submittedUser.id, facultyUser.id, employeeUser.id] } }
    });

    await prisma.userRole.createMany({
        data: [
            { userId: admin.id, role: 'SUPER_ADMIN' },
            { userId: hrUser.id, role: 'HR' },
            { userId: hodUser.id, role: 'HOD' },
            { userId: committeeUser.id, role: 'COMMITTEE' },
            { userId: draftUser.id, role: 'FACULTY' },
            { userId: submittedUser.id, role: 'EMPLOYEE' },
            { userId: facultyUser.id, role: 'FACULTY' },
            { userId: employeeUser.id, role: 'EMPLOYEE' }
        ]
    });

    await prisma.department.update({
        where: { id: csDept.id },
        data: { hodId: hodUser.id }
    });

    const cycle = await findOrCreateCycle(
        '2025-2026 Annual Appraisal Cycle',
        new Date('2025-04-01T00:00:00.000Z'),
        new Date('2026-03-31T23:59:59.000Z'),
        true
    );

    const committee = await findOrCreateCommittee('Annual Review Committee', [committeeUser.id]);

    const draftAppraisal = await upsertAppraisal({
        cycleId: cycle.id,
        userId: draftUser.id,
        status: 'DRAFT',
        items: [
            { key: 'teaching_effectiveness', points: 3, weight: 30, notes: 'Strong student feedback' },
            { key: 'research_output', points: 2, weight: 40, notes: 'Two publications in progress' },
            { key: 'service_and_commitment', points: 4, weight: 30, notes: 'Active in department initiatives' }
        ]
    });

    const submittedAppraisal = await upsertAppraisal({
        cycleId: cycle.id,
        userId: submittedUser.id,
        status: 'SUBMITTED',
        submittedAt: new Date('2026-02-10T10:00:00.000Z'),
        items: [
            { key: 'attendance', points: 4, weight: 20, notes: 'Excellent attendance' },
            { key: 'task_completion', points: 3, weight: 50, notes: 'Consistently meets deadlines' },
            { key: 'teamwork', points: 4, weight: 30, notes: 'Supports peers proactively' }
        ]
    });

    const hodReviewAppraisal = await upsertAppraisal({
        cycleId: cycle.id,
        userId: employeeUser.id,
        status: 'HOD_REVIEW',
        submittedAt: new Date('2026-02-11T09:00:00.000Z'),
        items: [
            { key: 'attendance', points: 4, weight: 25, notes: 'Very reliable' },
            { key: 'task_completion', points: 3, weight: 45, notes: 'Solid delivery record' },
            { key: 'teamwork', points: 4, weight: 30, notes: 'Collaborative and responsive' }
        ]
    });

    const committeeReviewAppraisal = await upsertAppraisal({
        cycleId: cycle.id,
        userId: facultyUser.id,
        status: 'COMMITTEE_REVIEW',
        submittedAt: new Date('2026-02-12T09:00:00.000Z'),
        items: [
            { key: 'teaching_effectiveness', points: 3, weight: 35, notes: 'Positive classroom reviews' },
            { key: 'research_output', points: 3, weight: 35, notes: 'One paper accepted' },
            { key: 'service_and_commitment', points: 4, weight: 30, notes: 'Department coordinator' }
        ]
    });

    const hrFinalizedAppraisal = await upsertAppraisal({
        cycleId: cycle.id,
        userId: admin.id,
        status: 'HR_FINALIZED',
        submittedAt: new Date('2026-02-01T09:00:00.000Z'),
        locked: true,
        finalScore: 3.75,
        finalPercent: 93.8,
        hodRemarks: 'Consistently exceeds expectations.',
        committeeNotes: 'Approved without changes.',
        items: [
            { key: 'leadership', points: 4, weight: 40, notes: 'Strong leadership across teams' },
            { key: 'delivery', points: 4, weight: 40, notes: 'Always on time' },
            { key: 'collaboration', points: 3, weight: 20, notes: 'Works well with stakeholders' }
        ]
    });

    await prisma.committeeAssignment.deleteMany({
        where: { appraisalId: { in: [draftAppraisal.id, submittedAppraisal.id, hodReviewAppraisal.id, committeeReviewAppraisal.id, hrFinalizedAppraisal.id] } }
    });

    await prisma.committeeAssignment.createMany({
        data: [
            { committeeId: committee.id, appraisalId: hodReviewAppraisal.id },
            { committeeId: committee.id, appraisalId: committeeReviewAppraisal.id },
            { committeeId: committee.id, appraisalId: hrFinalizedAppraisal.id }
        ]
    });

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
