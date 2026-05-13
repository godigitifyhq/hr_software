import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { RoleName, User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { writeAuditLog } from '../lib/audit';
import {
    createCsrfToken,
    createFamilyId,
    createJti,
    createSecureToken,
    hashToken
} from '../lib/security';
import { signAccessToken, signRefreshToken } from '../lib/jwt';
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from '../schemas/auth';

const PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;
const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;
const REFRESH_TOKEN_TTL_DAYS = 30;

type SessionContext = {
    ipAddress?: string;
    userAgent?: string;
};

type SessionBundle = {
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
    user: UserWithRoles;
};

type UserWithRoles = User & {
    roles: { role: RoleName }[];
    department?: { id: string; name: string } | null;
};

type RefreshClaims = {
    sub: string;
    roles: RoleName[];
    familyId: string;
    jti: string;
};

function getMailer() {
    const host = process.env.EMAIL_SMTP_HOST;
    const user = process.env.EMAIL_SMTP_USER;
    const pass = process.env.EMAIL_SMTP_PASS;

    if (!host || !user || !pass) {
        throw new Error('Email transport is not configured');
    }

    return nodemailer.createTransport({
        host,
        port: Number(process.env.EMAIL_SMTP_PORT || 587),
        secure: process.env.EMAIL_SMTP_SECURE === 'true',
        auth: { user, pass }
    });
}

function getRefreshExpiry() {
    return new Date(Date.now() + 1000 * 60 * 60 * 24 * REFRESH_TOKEN_TTL_DAYS);
}

async function loadUserByEmail(email: string) {
    return prisma.user.findUnique({
        where: { email },
        include: {
            roles: true,
            department: {
                select: { id: true, name: true }
            }
        }
    });
}

async function loadUserById(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: true,
            department: {
                select: { id: true, name: true }
            }
        }
    });
}

export async function registerUser(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
        throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
        data: {
            email: input.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            departmentId: input.departmentId,
            passwordChangedAt: new Date(),
            mustChangePassword: false
        }
    });

    await writeAuditLog({
        actorId: user.id,
        action: 'auth.register',
        resource: 'User',
        resourceId: user.id,
        meta: { email: user.email }
    });

    return user;
}

async function createSession(user: UserWithRoles, context: SessionContext): Promise<SessionBundle> {
    const roles = user.roles.map(role => role.role);
    const familyId = createFamilyId();
    const jti = createJti();
    const csrfToken = createCsrfToken();
    const refreshToken = signRefreshToken({ sub: user.id, roles, familyId, jti } satisfies RefreshClaims);
    const refreshTokenRecord = await prisma.refreshToken.create({
        data: {
            userId: user.id,
            tokenHash: hashToken(refreshToken),
            familyId,
            jti,
            expiresAt: getRefreshExpiry(),
            userAgent: context.userAgent,
            ipAddress: context.ipAddress
        }
    });

    const accessToken = signAccessToken({
        sub: user.id,
        roles,
        sessionId: refreshTokenRecord.id,
        familyId
    });

    return { accessToken, refreshToken, csrfToken, user };
}

async function recordLoginAttempt(input: {
    email: string;
    userId?: string;
    success: boolean;
    reason?: string;
    context?: SessionContext;
}) {
    await prisma.loginAttempt.create({
        data: {
            email: input.email,
            userId: input.userId,
            success: input.success,
            reason: input.reason,
            ipAddress: input.context?.ipAddress,
            userAgent: input.context?.userAgent
        }
    });
}

export async function login(input: LoginInput, context: SessionContext): Promise<SessionBundle> {
    const user = await loadUserByEmail(input.email);

    if (!user) {
        await recordLoginAttempt({ email: input.email, success: false, reason: 'user_not_found', context });
        throw new Error('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
        await recordLoginAttempt({ email: input.email, userId: user.id, success: false, reason: 'account_locked', context });
        throw new Error('Account is temporarily locked');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
        const failedLoginCount = user.failedLoginCount + 1;
        const shouldLock = failedLoginCount >= LOCK_THRESHOLD;
        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginCount: shouldLock ? 0 : failedLoginCount,
                lockedUntil: shouldLock ? new Date(Date.now() + 1000 * 60 * LOCK_MINUTES) : user.lockedUntil
            }
        });

        await recordLoginAttempt({ email: input.email, userId: user.id, success: false, reason: 'invalid_password', context });
        await writeAuditLog({
            actorId: user.id,
            action: 'auth.login.failed',
            resource: 'User',
            resourceId: user.id,
            meta: { reason: 'invalid_password', failedLoginCount }
        });
        throw new Error('Invalid credentials');
    }

    const refreshedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            failedLoginCount: 0,
            lockedUntil: null,
            lastLoginAt: new Date()
        },
        include: { roles: true }
    });

    const session = await createSession(refreshedUser, context);

    await recordLoginAttempt({ email: input.email, userId: user.id, success: true, context });
    await writeAuditLog({
        actorId: user.id,
        action: 'auth.login.success',
        resource: 'User',
        resourceId: user.id,
        meta: { ipAddress: context.ipAddress, userAgent: context.userAgent }
    });

    return session;
}

export async function refreshSession(refreshToken: string, context: SessionContext): Promise<SessionBundle> {
    const tokenHash = hashToken(refreshToken);
    const currentRecord = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!currentRecord) {
        throw new Error('Invalid refresh token');
    }

    if (currentRecord.revokedAt) {
        await prisma.refreshToken.updateMany({
            where: { userId: currentRecord.userId, familyId: currentRecord.familyId, revokedAt: null },
            data: { revokedAt: new Date() }
        });
        await writeAuditLog({
            actorId: currentRecord.userId,
            action: 'auth.refresh.reuse_detected',
            resource: 'RefreshToken',
            resourceId: currentRecord.id,
            meta: { familyId: currentRecord.familyId, ipAddress: context.ipAddress, userAgent: context.userAgent }
        });
        throw new Error('Refresh token reuse detected');
    }

    const user = await loadUserById(currentRecord.userId);
    if (!user) {
        throw new Error('Invalid refresh token');
    }

    const roles = user.roles.map(role => role.role);
    const newJti = createJti();
    const newRefreshToken = signRefreshToken({ sub: user.id, roles, familyId: currentRecord.familyId, jti: newJti } satisfies RefreshClaims);

    await prisma.$transaction([
        prisma.refreshToken.update({
            where: { id: currentRecord.id },
            data: { revokedAt: new Date(), lastUsedAt: new Date() }
        }),
        prisma.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: hashToken(newRefreshToken),
                familyId: currentRecord.familyId,
                jti: newJti,
                expiresAt: getRefreshExpiry(),
                userAgent: context.userAgent,
                ipAddress: context.ipAddress
            }
        })
    ]);

    const accessToken = signAccessToken({ sub: user.id, roles, sessionId: currentRecord.id, familyId: currentRecord.familyId });
    const csrfToken = createCsrfToken();

    await writeAuditLog({
        actorId: user.id,
        action: 'auth.refresh.success',
        resource: 'RefreshToken',
        resourceId: currentRecord.id,
        meta: { familyId: currentRecord.familyId, ipAddress: context.ipAddress, userAgent: context.userAgent }
    });

    return { accessToken, refreshToken: newRefreshToken, csrfToken, user };
}

export async function logoutSession(refreshToken: string, context: SessionContext) {
    const tokenHash = hashToken(refreshToken);
    const currentRecord = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (currentRecord && !currentRecord.revokedAt) {
        await prisma.refreshToken.update({
            where: { id: currentRecord.id },
            data: { revokedAt: new Date() }
        });

        await writeAuditLog({
            actorId: currentRecord.userId,
            action: 'auth.logout',
            resource: 'RefreshToken',
            resourceId: currentRecord.id,
            meta: { ipAddress: context.ipAddress, userAgent: context.userAgent }
        });
    }
}

export async function requestPasswordReset(input: ForgotPasswordInput, context: SessionContext) {
    const user = await loadUserByEmail(input.email);
    if (!user) {
        await recordLoginAttempt({ email: input.email, success: false, reason: 'password_reset_unknown_email', context });
        return { accepted: true };
    }

    const token = createSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * PASSWORD_RESET_TOKEN_TTL_MINUTES);

    await prisma.passwordResetToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt
        }
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/forgot-password?token=${token}`;
    const mailer = getMailer();
    await mailer.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER || 'no-reply@svgoi.local',
        to: user.email,
        subject: 'Reset your SVGOI appraisal password',
        text: `Reset your password using this link: ${resetUrl}`,
        html: `<p>Reset your password using this link:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
    });

    await writeAuditLog({
        actorId: user.id,
        action: 'auth.password_reset.requested',
        resource: 'User',
        resourceId: user.id,
        meta: { ipAddress: context.ipAddress, userAgent: context.userAgent }
    });

    return { accepted: true };
}

export async function resetPassword(input: ResetPasswordInput, context: SessionContext) {
    const tokenHash = hashToken(input.token);
    const resetRecord = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: { include: { roles: true } } } });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
        throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    await prisma.$transaction([
        prisma.user.update({
            where: { id: resetRecord.userId },
            data: {
                passwordHash,
                passwordChangedAt: new Date(),
                failedLoginCount: 0,
                lockedUntil: null,
                mustChangePassword: false
            }
        }),
        prisma.passwordResetToken.update({
            where: { tokenHash },
            data: { usedAt: new Date() }
        }),
        prisma.refreshToken.updateMany({
            where: { userId: resetRecord.userId, revokedAt: null },
            data: { revokedAt: new Date() }
        })
    ]);

    await writeAuditLog({
        actorId: resetRecord.userId,
        action: 'auth.password_reset.completed',
        resource: 'User',
        resourceId: resetRecord.userId,
        meta: { ipAddress: context.ipAddress, userAgent: context.userAgent }
    });

    return { success: true };
}

export async function issueBootstrapSession(userId: string, context: SessionContext) {
    const user = await loadUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    return createSession(user, context);
}
