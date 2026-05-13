import { prisma } from './prisma';

export async function writeAuditLog(input: {
    actorId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    meta?: Record<string, unknown>;
}) {
    await prisma.auditLog.create({
        data: {
            actorId: input.actorId,
            action: input.action,
            resource: input.resource,
            resourceId: input.resourceId,
            meta: input.meta ? JSON.stringify(input.meta) : undefined,
            immutable: true
        }
    });
}
