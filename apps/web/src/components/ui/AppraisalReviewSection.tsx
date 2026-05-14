"use client";

import { ExternalLink } from "lucide-react";

type EvidenceItem = {
  url: string;
  fileName?: string;
  mime?: string;
  size?: number;
};

export interface AppraisalReviewItemProps {
  title: string;
  heading: string;
  approvedPoints: number;
  previousPoints?: number;
  remark?: string | null;
  evidence?: EvidenceItem[] | null;
  timestamp?: string | null;
  reviewer?: string;
  isCurrentReview?: boolean;
  inputProps?: {
    approvedPointsValue: number;
    remarkValue: string;
    onApprovedPointsChange: (value: number) => void;
    onRemarkChange: (value: string) => void;
  };
}

function fullEvidenceUrl(url: string, apiOrigin: string = "") {
  return url.startsWith("http") ? url : `${apiOrigin}${url}`;
}

export function AppraisalReviewItem({
  title,
  heading,
  approvedPoints,
  previousPoints,
  remark,
  evidence,
  timestamp,
  reviewer,
  isCurrentReview = false,
  inputProps,
}: AppraisalReviewItemProps) {
  const showDeduction =
    previousPoints !== undefined && approvedPoints < previousPoints;
  const deductionAmount = previousPoints ? previousPoints - approvedPoints : 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-text">{heading}</h4>
          <p className="text-xs text-text-3">{title}</p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <div className="flex items-baseline gap-2">
            {showDeduction && (
              <span className="inline-flex items-center rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning">
                -{deductionAmount}
              </span>
            )}
            <span className="text-lg font-bold text-text">
              {approvedPoints}
            </span>
            {previousPoints && previousPoints !== approvedPoints && (
              <span className="text-xs text-text-3">from {previousPoints}</span>
            )}
          </div>
          {timestamp && (
            <p className="text-[11px] text-text-3">
              {new Date(timestamp).toLocaleDateString("en-GB")}
            </p>
          )}
        </div>
      </div>

      {/* Display Mode - Show existing data */}
      {!isCurrentReview && (
        <>
          {remark && (
            <div className="mt-3 rounded-lg bg-bg p-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-text-3">
                Remark{reviewer && ` (${reviewer})`}
              </p>
              <p className="mt-1 text-sm text-text-2">{remark}</p>
            </div>
          )}
        </>
      )}

      {/* Edit Mode - Show input fields */}
      {isCurrentReview && inputProps && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-text-3">
                Approved Points
              </label>
              <input
                type="number"
                value={inputProps.approvedPointsValue}
                onChange={(e) =>
                  inputProps.onApprovedPointsChange(Number(e.target.value))
                }
                min={0}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-3">
                Remark {showDeduction ? "(Required)" : "(Optional)"}
              </label>
              <input
                value={inputProps.remarkValue}
                onChange={(e) => inputProps.onRemarkChange(e.target.value)}
                placeholder="Add remark..."
                className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm"
              />
            </div>
          </div>
        </>
      )}

      {/* Evidence */}
      {evidence && evidence.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-text-3">
            Evidence
          </p>
          <div className="mt-2 space-y-1">
            {evidence.map((item, idx) => (
              <a
                key={idx}
                href={fullEvidenceUrl(item.url)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-brand hover:text-brand-dark"
              >
                <span className="truncate">{item.fileName || "View"}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface AppraisalReviewLayerProps {
  title: string;
  description?: string;
  items: Array<{
    itemId: string;
    heading: string;
    approvedPoints: number;
    previousPoints?: number;
    remark?: string | null;
    evidence?: EvidenceItem[] | null;
    timestamp?: string | null;
    reviewer?: string;
  }>;
  isCurrentReview?: boolean;
  itemInputs?: Record<
    string,
    {
      approvedPointsValue: number;
      remarkValue: string;
      onApprovedPointsChange: (value: number) => void;
      onRemarkChange: (value: string) => void;
    }
  >;
}

export function AppraisalReviewLayer({
  title,
  description,
  items,
  isCurrentReview = false,
  itemInputs,
}: AppraisalReviewLayerProps) {
  const totalPoints = items.reduce((sum, item) => sum + item.approvedPoints, 0);

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-border bg-bg p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-text">{title}</h3>
            {description && (
              <p className="mt-1 text-xs text-text-2">{description}</p>
            )}
          </div>
          <div className="flex-shrink-0 rounded-lg bg-surface px-3 py-1">
            <p className="text-xs font-semibold text-text-3">
              Total: <span className="text-text">{totalPoints}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <AppraisalReviewItem
            key={item.itemId}
            title={title}
            heading={item.heading}
            approvedPoints={item.approvedPoints}
            previousPoints={item.previousPoints}
            remark={item.remark}
            evidence={item.evidence}
            timestamp={item.timestamp}
            reviewer={item.reviewer}
            isCurrentReview={isCurrentReview}
            inputProps={isCurrentReview ? itemInputs?.[item.itemId] : undefined}
          />
        ))}
      </div>
    </section>
  );
}
