import express from 'express';
import { authenticateRequest, AuthenticatedRequest, requireRoles } from '../middleware/rbac';
import { prisma } from '../lib/prisma';
import { calculateHodScore, persistHodScore } from '../services/hodScoringService';

const router: express.Router = express.Router();

router.post('/scoring/preview', authenticateRequest, requireRoles('HOD', 'HR', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const result = await calculateHodScore(req.body ?? {});
        res.json({ success: true, message: 'Preview generated', data: result });
    } catch (error) {
        next(error);
    }
});

router.post('/appraisals/:appraisalId/score', authenticateRequest, requireRoles('HOD', 'HR', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res, next) => {
    try {
        const { appraisalId } = req.params;
        const { metrics, remarks } = req.body ?? {};
        const actorId = req.auth?.sub;

        if (!actorId) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }

        const appraisal = await prisma.appraisal.findUnique({
            where: { id: appraisalId },
            select: {
                id: true,
                status: true,
                userId: true,
                user: { select: { departmentId: true } }
            }
        });

        if (!appraisal) {
            res.status(404).json({ success: false, message: 'Appraisal not found' });
            return;
        }

        if (!['SUBMITTED', 'HOD_REVIEW'].includes(appraisal.status)) {
            res.status(400).json({ success: false, message: 'Appraisal is not ready for HOD scoring' });
            return;
        }

        const isHr = req.auth?.roles?.includes('HR') || req.auth?.roles?.includes('SUPER_ADMIN');
        if (!isHr) {
            const hasDepartmentMatch = await prisma.department.findFirst({
                where: {
                    hodId: actorId,
                    id: appraisal.user.departmentId ?? undefined
                },
                select: { id: true }
            });

            if (!hasDepartmentMatch) {
                res.status(403).json({ success: false, message: 'Access denied' });
                return;
            }
        }

        const result = await persistHodScore({ appraisalId, actorId, remarks, metrics });
        res.json({ success: true, message: 'Appraisal scored', data: result });
    } catch (error) {
        next(error);
    }
});

export default router;
