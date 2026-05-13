import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt';

export type AuthClaims = {
    sub: string;
    roles: string[];
    sessionId?: string;
    familyId?: string;
};

export type AuthenticatedRequest = Request & { auth?: AuthClaims };

export function authenticateRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const authorization = req.headers.authorization;
        if (!authorization?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Missing bearer token' });
        }

        const token = authorization.slice('Bearer '.length);
        const claims = verifyToken<AuthClaims>(token);
        req.auth = claims;
        return next();
    } catch {
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

