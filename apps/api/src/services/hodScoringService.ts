import { AppraisalStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { writeAuditLog } from '../lib/audit';

export type HodgeMetrics = {
    academicsAveragePercent?: number;
    scopusPaperCount?: number;
    impactFactor?: number;
    bookChapterCount?: number;
    nationalPublisherBooks?: number;
    internationalPublisherBooks?: number;
    designPatentCount?: number;
    utilityPatentCount?: number;
    conferenceLevel?: 'attended' | 'presentedNational' | 'organizedTwoOrMore' | 'organizedInternational';
    fdpLevel?: 'attended' | 'conducted' | 'onlineCertificate' | 'moocDeveloped';
    consultancyAmount?: number;
    thesisGuidanceLevel?: 'oneThesis' | 'oneThesisOnePaper' | 'twoTheses' | 'twoThesesTwoPapers';
    coCurricularLevel?: 'participate' | 'coordinator' | 'overallCoordinator' | 'sponsoredEvent';
    attendancePercent?: number;
    awardsLevel?: 'institutional' | 'state' | 'nationalOrTwiceEmployeeOfTheMonth' | 'multipleAwards';
    feeRecoveryPercent?: number;
    awardsOutsideSvgoiLevel?: 'upto2' | 'cashPrize' | 'nitIit' | 'moreThan2';
    overallUniversityResultPercent?: number;
    placementPercent?: number;
    departmentStudentPositionsPercent?: number;
    hodRemarksPoints?: number;
    memoIssues?: number;
};

export type ScoreBreakdownItem = {
    key: string;
    label: string;
    points: number;
    note?: string;
};

export type HodScoreResult = {
    totalPoints: number;
    deductionPoints: number;
    netPoints: number;
    finalIncrementPercent: number;
    noIncrement: boolean;
    breakdown: ScoreBreakdownItem[];
    memoPolicyNote?: string;
};

type BracketRule = {
    min?: number;
    max?: number;
    points: number;
    note?: string;
};

type HODScoringPolicy = {
    brackets: {
        academicsAveragePercent: BracketRule[];
        scopusPaperCount: BracketRule[];
        impactFactor: BracketRule[];
        publicationAndPatentLevel: BracketRule[];
        conferenceLevel: BracketRule[];
        fdpLevel: BracketRule[];
        consultancyAmount: BracketRule[];
        thesisGuidanceLevel: BracketRule[];
        coCurricularLevel: BracketRule[];
        attendancePercent: BracketRule[];
        awardsLevel: BracketRule[];
        feeRecoveryPercent: BracketRule[];
        awardsOutsideSvgoiLevel: BracketRule[];
        overallUniversityResultPercent: BracketRule[];
        placementPercent: BracketRule[];
        departmentStudentPositionsPercent: BracketRule[];
        hodRemarksPoints: BracketRule[];
    };
    incrementBrackets: BracketRule[];
    memoDeductions: {
        twoMemos: number;
        threeOrFourMemos: number;
        fiveMemos: number;
        moreThanFiveNoIncrement: boolean;
    };
};

const defaultPolicy: HODScoringPolicy = {
    brackets: {
        academicsAveragePercent: [
            { max: 40, points: 1, note: 'Below 40%' },
            { min: 40, max: 60, points: 2, note: '40% to 60%' },
            { min: 60, max: 80, points: 3, note: '60% to 80%' },
            { min: 80, points: 4, note: 'Above 80%' }
        ],
        scopusPaperCount: [
            { min: 1, max: 1, points: 1 },
            { min: 2, max: 2, points: 2 },
            { min: 3, max: 3, points: 3 },
            { min: 4, points: 4 }
        ],
        impactFactor: [
            { min: 0, max: 2, points: 1 },
            { min: 2, max: 5, points: 2 },
            { min: 5, max: 8, points: 3 },
            { min: 8, points: 4 }
        ],
        publicationAndPatentLevel: [
            { min: 1, max: 1, points: 1, note: '1 Book Chapter' },
            { min: 2, max: 2, points: 2, note: 'Book/Design Patent/Edited/Author National Publisher' },
            { min: 3, max: 3, points: 3, note: 'Book/Edited/Author International Publisher' },
            { min: 4, points: 4, note: '2 Design Patents / 1 Utility Patent (Granted)' }
        ],
        conferenceLevel: [
            { min: 1, max: 1, points: 1, note: 'Any one attended' },
            { min: 2, max: 2, points: 2, note: 'National conference/seminar/symposium presentation' },
            { min: 3, max: 3, points: 3, note: 'Organised seminar/presentation in two or more' },
            { min: 4, points: 4, note: 'Organised national/international conference in campus' }
        ],
        fdpLevel: [
            { min: 1, max: 1, points: 1, note: 'FDP attended' },
            { min: 2, max: 2, points: 2, note: 'FDP conducted' },
            { min: 3, max: 3, points: 3, note: 'Online certificate / STP in or outside campus' },
            { min: 4, points: 4, note: 'MOOC developed by faculty' }
        ],
        consultancyAmount: [
            { min: 10000, max: 50000, points: 1 },
            { min: 51000, max: 100000, points: 2 },
            { min: 100000, max: 200000, points: 3 },
            { min: 200000, points: 4 }
        ],
        thesisGuidanceLevel: [
            { min: 1, max: 1, points: 1 },
            { min: 2, max: 2, points: 2 },
            { min: 3, max: 3, points: 3 },
            { min: 4, points: 4 }
        ],
        coCurricularLevel: [
            { min: 1, max: 1, points: 1 },
            { min: 2, max: 2, points: 2 },
            { min: 3, max: 3, points: 3 },
            { min: 4, points: 4 }
        ],
        attendancePercent: [
            { min: 80, max: 89.999, points: 1 },
            { min: 90, max: 94.999, points: 2 },
            { min: 95, max: 99.999, points: 3 },
            { min: 100, points: 4 }
        ],
        awardsLevel: [
            { min: 1, max: 1, points: 1 },
            { min: 2, max: 2, points: 2 },
            { min: 3, max: 3, points: 3 },
            { min: 4, points: 4 }
        ],
        feeRecoveryPercent: [
            { min: 50, max: 69.999, points: 1 },
            { min: 70, max: 79.999, points: 2 },
            { min: 80, max: 89.999, points: 3 },
            { min: 90, points: 4 }
        ],
        awardsOutsideSvgoiLevel: [
            { min: 1, max: 1, points: 1 },
            { min: 2, max: 2, points: 2 },
            { min: 3, max: 3, points: 3 },
            { min: 4, points: 4 }
        ],
        overallUniversityResultPercent: [
            { min: 50, max: 59.999, points: 1 },
            { min: 60, max: 69.999, points: 2 },
            { min: 70, max: 79.999, points: 3 },
            { min: 80, points: 4 }
        ],
        placementPercent: [
            { min: 30, max: 49.999, points: 1 },
            { min: 50, max: 69.999, points: 2 },
            { min: 70, max: 79.999, points: 3 },
            { min: 80, points: 4 }
        ],
        departmentStudentPositionsPercent: [
            { min: 0, max: 5, points: 1 },
            { min: 3, max: 3.999, points: 2 },
            { min: 5, max: 9.999, points: 3 },
            { min: 10, points: 4 }
        ],
        hodRemarksPoints: [
            { min: 1, max: 1, points: 1 },
            { min: 2, max: 2, points: 2 },
            { min: 3, max: 3, points: 3 },
            { min: 4, points: 4 }
        ]
    },
    incrementBrackets: [
        { max: 12, points: 5, note: '0 to 12 points' },
        { min: 13, max: 20, points: 8, note: '13 to 20 points' },
        { min: 21, max: 30, points: 10, note: '21 to 30 points' },
        { min: 31, points: 15, note: 'More than 30 points' }
    ],
    memoDeductions: {
        twoMemos: 2,
        threeOrFourMemos: 4,
        fiveMemos: 8,
        moreThanFiveNoIncrement: true
    }
};

function matches(rule: BracketRule, value: number) {
    const lowerOk = typeof rule.min === 'undefined' || value >= rule.min;
    const upperOk = typeof rule.max === 'undefined' || value <= rule.max;
    return lowerOk && upperOk;
}

function scoreBracket(value: number | undefined, rules: BracketRule[], label: string): ScoreBreakdownItem {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return { key: label, label, points: 0, note: 'Not provided' };
    }

    const rule = rules.find(candidate => matches(candidate, value));
    if (!rule) {
        return { key: label, label, points: 0, note: `No rule matched for ${value}` };
    }

    return { key: label, label, points: rule.points, note: rule.note };
}

function mapPublicationAndPatentLevel(input: HodgeMetrics): number | undefined {
    const levels = [
        input.bookChapterCount ? 1 : 0,
        input.nationalPublisherBooks ? 2 : 0,
        input.internationalPublisherBooks ? 3 : 0,
        input.designPatentCount || input.utilityPatentCount ? 4 : 0
    ].filter(Boolean) as number[];

    if (!levels.length) {
        return undefined;
    }

    return Math.max(...levels);
}

function mapConferenceLevel(level?: HodgeMetrics['conferenceLevel']): number | undefined {
    if (!level) {
        return undefined;
    }

    return {
        attended: 1,
        presentedNational: 2,
        organizedTwoOrMore: 3,
        organizedInternational: 4
    }[level];
}

function mapFdpLevel(level?: HodgeMetrics['fdpLevel']): number | undefined {
    if (!level) {
        return undefined;
    }

    return {
        attended: 1,
        conducted: 2,
        onlineCertificate: 3,
        moocDeveloped: 4
    }[level];
}

function mapThesisLevel(level?: HodgeMetrics['thesisGuidanceLevel']): number | undefined {
    if (!level) {
        return undefined;
    }

    return {
        oneThesis: 1,
        oneThesisOnePaper: 2,
        twoTheses: 3,
        twoThesesTwoPapers: 4
    }[level];
}

function mapCoCurricularLevel(level?: HodgeMetrics['coCurricularLevel']): number | undefined {
    if (!level) {
        return undefined;
    }

    return {
        participate: 1,
        coordinator: 2,
        overallCoordinator: 3,
        sponsoredEvent: 4
    }[level];
}

function mapAwardsLevel(level?: HodgeMetrics['awardsLevel']): number | undefined {
    if (!level) {
        return undefined;
    }

    return {
        institutional: 1,
        state: 2,
        nationalOrTwiceEmployeeOfTheMonth: 3,
        multipleAwards: 4
    }[level];
}

function mapAwardsOutsideSvgoiLevel(level?: HodgeMetrics['awardsOutsideSvgoiLevel']): number | undefined {
    if (!level) {
        return undefined;
    }

    return {
        upto2: 1,
        cashPrize: 2,
        nitIit: 3,
        moreThan2: 4
    }[level];
}

function calculateIncrement(totalPoints: number, policy: HODScoringPolicy) {
    const bracket = policy.incrementBrackets.find(rule => matches(rule, totalPoints));
    return { points: bracket?.points ?? 0, note: bracket?.note };
}

function calculateMemoDeduction(memoIssues: number | undefined, policy: HODScoringPolicy) {
    if (typeof memoIssues !== 'number' || memoIssues <= 1) {
        return { deductionPoints: 0, noIncrement: false, note: undefined };
    }

    if (memoIssues === 2) {
        return { deductionPoints: policy.memoDeductions.twoMemos, noIncrement: false, note: '2 memo issues' };
    }

    if (memoIssues === 3 || memoIssues === 4) {
        return { deductionPoints: policy.memoDeductions.threeOrFourMemos, noIncrement: false, note: '3 to 4 memo issues' };
    }

    if (memoIssues === 5) {
        return { deductionPoints: policy.memoDeductions.fiveMemos, noIncrement: false, note: '5 memo issues with 3 holidays' };
    }

    return { deductionPoints: 0, noIncrement: policy.memoDeductions.moreThanFiveNoIncrement, note: 'More than 5 memo issues' };
}

async function loadPolicy(): Promise<HODScoringPolicy> {
    const stored = await prisma.scoringConfig.findUnique({ where: { key: 'hod-default' } });
    if (!stored) {
        return defaultPolicy;
    }

    try {
        const parsed = JSON.parse(stored.schemaJson) as Partial<HODScoringPolicy>;
        return {
            ...defaultPolicy,
            ...parsed,
            brackets: { ...defaultPolicy.brackets, ...(parsed.brackets || {}) },
            incrementBrackets: parsed.incrementBrackets || defaultPolicy.incrementBrackets,
            memoDeductions: { ...defaultPolicy.memoDeductions, ...(parsed.memoDeductions || {}) }
        };
    } catch {
        return defaultPolicy;
    }
}

export async function calculateHodScore(input: HodgeMetrics): Promise<HodScoreResult> {
    const policy = await loadPolicy();
    const breakdown: ScoreBreakdownItem[] = [];

    breakdown.push(scoreBracket(input.academicsAveragePercent, policy.brackets.academicsAveragePercent, 'academicsAveragePercent'));
    breakdown.push(scoreBracket(input.scopusPaperCount, policy.brackets.scopusPaperCount, 'scopusPaperCount'));
    breakdown.push(scoreBracket(input.impactFactor, policy.brackets.impactFactor, 'impactFactor'));
    breakdown.push(scoreBracket(mapPublicationAndPatentLevel(input), policy.brackets.publicationAndPatentLevel, 'bookChapterBookPatent'));
    breakdown.push(scoreBracket(mapConferenceLevel(input.conferenceLevel), policy.brackets.conferenceLevel, 'conferenceLevel'));
    breakdown.push(scoreBracket(mapFdpLevel(input.fdpLevel), policy.brackets.fdpLevel, 'fdpLevel'));
    breakdown.push(scoreBracket(input.consultancyAmount, policy.brackets.consultancyAmount, 'consultancyAmount'));
    breakdown.push(scoreBracket(mapThesisLevel(input.thesisGuidanceLevel), policy.brackets.thesisGuidanceLevel, 'thesisGuidanceLevel'));
    breakdown.push(scoreBracket(mapCoCurricularLevel(input.coCurricularLevel), policy.brackets.coCurricularLevel, 'coCurricularLevel'));
    breakdown.push(scoreBracket(input.attendancePercent, policy.brackets.attendancePercent, 'attendancePercent'));
    breakdown.push(scoreBracket(mapAwardsLevel(input.awardsLevel), policy.brackets.awardsLevel, 'awardsLevel'));
    breakdown.push(scoreBracket(input.feeRecoveryPercent, policy.brackets.feeRecoveryPercent, 'feeRecoveryPercent'));
    breakdown.push(scoreBracket(mapAwardsOutsideSvgoiLevel(input.awardsOutsideSvgoiLevel), policy.brackets.awardsOutsideSvgoiLevel, 'awardsOutsideSvgoiLevel'));
    breakdown.push(scoreBracket(input.overallUniversityResultPercent, policy.brackets.overallUniversityResultPercent, 'overallUniversityResultPercent'));
    breakdown.push(scoreBracket(input.placementPercent, policy.brackets.placementPercent, 'placementPercent'));
    breakdown.push(scoreBracket(input.departmentStudentPositionsPercent, policy.brackets.departmentStudentPositionsPercent, 'departmentStudentPositionsPercent'));
    breakdown.push(scoreBracket(input.hodRemarksPoints, policy.brackets.hodRemarksPoints, 'hodRemarksPoints'));

    const totalPoints = breakdown.reduce((sum, item) => sum + item.points, 0);
    const memoDeduction = calculateMemoDeduction(input.memoIssues, policy);
    const increment = calculateIncrement(totalPoints, policy);
    const netPoints = Math.max(totalPoints - memoDeduction.deductionPoints, 0);

    return {
        totalPoints,
        deductionPoints: memoDeduction.deductionPoints,
        netPoints,
        finalIncrementPercent: memoDeduction.noIncrement ? 0 : increment.points,
        noIncrement: memoDeduction.noIncrement,
        breakdown,
        memoPolicyNote: memoDeduction.note
    };
}

export async function persistHodScore(input: {
    appraisalId: string;
    actorId: string;
    remarks?: string;
    metrics: HodgeMetrics;
}) {
    const appraisal = await prisma.appraisal.findUnique({ where: { id: input.appraisalId } });
    if (!appraisal) {
        throw new Error('Appraisal not found');
    }

    if (appraisal.locked) {
        throw new Error('Appraisal is locked');
    }

    const result = await calculateHodScore(input.metrics);

    const updated = await prisma.appraisal.update({
        where: { id: input.appraisalId },
        data: {
            finalScore: result.netPoints,
            finalPercent: result.finalIncrementPercent,
            hodRemarks: input.remarks,
            status: AppraisalStatus.HOD_REVIEW,
            locked: true,
            committeeNotes: result.memoPolicyNote
        }
    });

    await writeAuditLog({
        actorId: input.actorId,
        action: 'appraisal.hod.score.persisted',
        resource: 'Appraisal',
        resourceId: updated.id,
        meta: { result }
    });

    return { appraisal: updated, result };
}
