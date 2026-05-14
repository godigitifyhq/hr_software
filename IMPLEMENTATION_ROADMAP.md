# Appraisal System Enhancement - Implementation Roadmap

## Overview

Enhanced workflow: Faculty → HOD Review → Committee Review → HR Finalization

## Phase 1: Multi-File Upload & Category Support ✓

- [x] Update seed data: faculty & committee in CS dept
- [ ] Add criterion categories (Academics, Research, Others)
- [ ] Support multiple evidence files per criterion
- [ ] Update appraisal evidence storage

## Phase 2: Faculty Dashboard Enhancement

- [ ] Add "View Submitted Form" button on faculty dashboard
- [ ] Show submitted form with all criteria, selections, and uploaded evidence
- [ ] Display HOD remarks if available
- [ ] Display committee remarks if available

## Phase 3: Committee Dashboard Creation

- [ ] Create committee dashboard endpoint (`/hod/requests` reused for committee)
- [ ] Filter criteria by category: Academics, Research, Others
- [ ] Show faculty's submitted form
- [ ] Show HOD's approval with marks and remarks
- [ ] Allow committee to:
  - View full form
  - Deduct marks (must add remarks)
  - Add remarks per criterion
  - Approve without changes
  - Submit final review

## Phase 4: Committee Profile (Optional)

- [ ] Make profile completion optional for COMMITTEE role
- [ ] Allow committee to access dashboard without completing profile
- [ ] Redirect to profile only if they try to access profile page

## Phase 5: Status Flow Updates

- [ ] Faculty submits → Status: HOD_REVIEW
- [ ] HOD approves → Status: COMMITTEE_REVIEW
- [ ] HOD rejects → Status: REJECTED (back to DRAFT for faculty)
- [ ] Committee approves → Status: COMMITTEE_APPROVED
- [ ] Committee rejects → Status: REJECTED
- [ ] HR finalizes → Status: HR_FINALIZED

## Files to Modify

- apps/api/src/lib/facultyDocuments.ts - Add categories
- apps/api/src/routes/faculty.ts - Multi-file support, evidence handling
- apps/api/src/routes/hod.ts - Committee dashboard logic
- apps/web/app/faculty-dashboard/page.tsx - View submitted form
- apps/web/app/committee-review/page.tsx - Committee dashboard
- apps/api/src/middleware/protected-route.tsx - Profile optional for committee

## Database Considerations

- AppraisalItem may need `category` field for filtering
- Document table already supports multiple files per criterion (by fieldKey)
- AppraisalItem notes store JSON with evidence details
