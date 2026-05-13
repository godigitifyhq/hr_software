// apps/web/src/components/ui/StatusBadge.tsx
import type { AppraisalStatus } from "@svgoi/shared-types";

const statusMap: Record<AppraisalStatus, { label: string; className: string }> =
  {
    DRAFT: {
      label: "Draft",
      className: "border-purple/20 bg-purple-bg text-purple",
    },
    SUBMITTED: {
      label: "Submitted",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    },
    HOD_REVIEW: {
      label: "HOD Review",
      className: "border-brand/20 bg-brand-light text-brand",
    },
    COMMITTEE_REVIEW: {
      label: "Committee Review",
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    },
    HR_FINALIZED: {
      label: "Finalized",
      className: "border-success/20 bg-success-bg text-success",
    },
    CLOSED: {
      label: "Closed",
      className: "border-slate-200 bg-slate-100 text-slate-600",
    },
  };

export function StatusBadge({
  status,
  className = "",
}: {
  status: AppraisalStatus;
  className?: string;
}) {
  const config = statusMap[status] ?? statusMap.DRAFT;

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${config.className} ${className}`.trim()}
    >
      {config.label}
    </span>
  );
}
