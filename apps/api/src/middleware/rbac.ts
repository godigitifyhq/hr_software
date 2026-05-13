import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export type AuthClaims = {
    sub: string;
    roles: string[];
    sessionId?: string;
    familyId?: string;
};

export type AuthenticatedRequest = Request & { auth?: AuthClaims };

export async function authenticateRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const authorization = req.headers.authorization;
        if (!authorization?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Missing bearer token' });
        }

        const token = authorization.slice('Bearer '.length);
        const claims = verifyToken<AuthClaims>(token);

        // load user to validate account state (locked, deleted)
        const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: { id: true, lockedUntil: true, deletedAt: true, email: true } });
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        if (user.deletedAt) {
            return res.status(403).json({ success: false, message: 'Account disabled' });
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            return res.status(403).json({ success: false, message: 'Account temporarily locked' });
        }

        req.auth = claims;
        return next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}

export function requireRoles(...allowedRoles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.auth) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const permitted = req.auth.roles.some(role => allowedRoles.includes(role));
        if (!permitted) {
            return res.status(403).json({ success: false, message: 'Insufficient role permissions' });
        }

        return next();
    };
}

