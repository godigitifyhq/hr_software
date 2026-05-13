import express from 'express';
import {
    forgotPasswordSchema,
    loginSchema,
    registerSchema,
    resetPasswordSchema
} from '../schemas/auth';
import {
    login,
    logoutSession,
    refreshSession,
    registerUser,
    requestPasswordReset,
    resetPassword
} from '../services/authService';

const router: express.Router = express.Router();

function getContext(req: express.Request) {
    return {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined
    };
}

function requireCsrf(req: express.Request, res: express.Response) {
    const cookieToken = req.cookies['csrf'];
    const headerToken = req.get('x-csrf-token');

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        res.status(403).json({ success: false, message: 'CSRF validation failed' });
        return false;
    }

    return true;
}

function setSessionCookies(res: express.Response, refreshToken: string, csrfToken: string) {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('rt', refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/api/v1/auth/refresh'
    });

    res.cookie('csrf', csrfToken, {
        httpOnly: false,
        secure,
        sameSite: 'lax',
        path: '/'
    });
}

router.post('/register', async (req, res, next) => {
    try {
        const parsed = registerSchema.parse(req.body);
        const user = await registerUser(parsed);
        res.status(201).json({ success: true, message: 'Registered', data: { id: user.id, email: user.email } });
    } catch (error) {
        next(error);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const parsed = loginSchema.parse(req.body);
        const session = await login(parsed, getContext(req));
        setSessionCookies(res, session.refreshToken, session.csrfToken);
        res.json({
            success: true,
            message: 'Logged in',
            data: {
                accessToken: session.accessToken,
                user: {
                    id: session.user.id,
                    email: session.user.email,
                    firstName: session.user.firstName,
                    lastName: session.user.lastName,
                    roles: session.user.roles.map((r: any) => r.role),
                    departmentId: session.user.departmentId,
                    department: session.user.department
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/refresh', async (req, res, next) => {
    try {
        if (!requireCsrf(req, res)) {
            return;
        }

        const refreshToken = req.cookies['rt'] || req.body.refreshToken;
        if (!refreshToken) {
            res.status(401).json({ success: false, message: 'Missing refresh token' });
            return;
        }

        const session = await refreshSession(refreshToken, getContext(req));
        setSessionCookies(res, session.refreshToken, session.csrfToken);
        res.json({ success: true, message: 'Session refreshed', data: { accessToken: session.accessToken } });
    } catch (error) {
        next(error);
    }
});

router.post('/logout', async (req, res, next) => {
    try {
        if (!requireCsrf(req, res)) {
            return;
        }

        const refreshToken = req.cookies['rt'] || req.body.refreshToken;
        if (refreshToken) {
            await logoutSession(refreshToken, getContext(req));
        }

        const secure = process.env.NODE_ENV === 'production';
        res.clearCookie('rt', { httpOnly: true, secure, sameSite: 'lax', path: '/api/v1/auth/refresh' });
        res.clearCookie('csrf', { secure, sameSite: 'lax', path: '/' });
        res.json({ success: true, message: 'Logged out' });
    } catch (error) {
        next(error);
    }
});

router.post('/forgot-password', async (req, res, next) => {
    try {
        const parsed = forgotPasswordSchema.parse(req.body);
        await requestPasswordReset(parsed, getContext(req));
        res.json({ success: true, message: 'If the account exists, a reset email has been sent' });
    } catch (error) {
        next(error);
    }
});

router.post('/reset-password', async (req, res, next) => {
    try {
        const parsed = resetPasswordSchema.parse(req.body);
        await resetPassword(parsed, getContext(req));
        res.json({ success: true, message: 'Password updated' });
    } catch (error) {
        next(error);
    }
});

export default router;
