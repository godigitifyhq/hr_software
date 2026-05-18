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

type CachedUserState = {
    lockedUntil: Date | null;
    deletedAt: Date | null;
    cachedAt: number;
};

// Short-lived cache to avoid a DB round-trip on every request for the same user.
// In serverless (Vercel), this helps warm instances handling multiple requests per container.
const USER_STATE_CACHE = new Map<string, CachedUserState>();
const USER_CACHE_TTL_MS = 30_000; // 30 seconds

function getCachedUserState(userId: string): CachedUserState | null {
    const entry = USER_STATE_CACHE.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > USER_CACHE_TTL_MS) {
        USER_STATE_CACHE.delete(userId);
        return null;
    }
    return entry;
}

function setCachedUserState(userId: string, state: Omit<CachedUserState, 'cachedAt'>) {
    // Prevent unbounded growth — evict oldest when over 500 entries
    if (USER_STATE_CACHE.size >= 500) {
        const firstKey = USER_STATE_CACHE.keys().next().value;
        if (firstKey) USER_STATE_CACHE.delete(firstKey);
    }
    USER_STATE_CACHE.set(userId, { ...state, cachedAt: Date.now() });
}

export function invalidateUserCache(userId: string) {
    USER_STATE_CACHE.delete(userId);
}

export async function authenticateRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const authorization = req.headers.authorization;
        if (!authorization?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Missing bearer token' });
        }

        const token = authorization.slice('Bearer '.length);
        const claims = verifyToken<AuthClaims>(token);

        let userState = getCachedUserState(claims.sub);

        if (!userState) {
            const user = await prisma.user.findUnique({
                where: { id: claims.sub },
                select: { id: true, lockedUntil: true, deletedAt: true },
            });

            if (!user) {
                return res.status(401).json({ success: false, message: 'User not found' });
            }

            userState = { lockedUntil: user.lockedUntil, deletedAt: user.deletedAt };
            setCachedUserState(claims.sub, userState);
        }

        if (userState.deletedAt) {
            return res.status(403).json({ success: false, message: 'Account disabled' });
        }

        if (userState.lockedUntil && userState.lockedUntil > new Date()) {
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
