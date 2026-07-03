// apps/web/src/components/ui/AppraisalSubmitPreviewDialog.tsx
"use client";

import { AlertTriangle, CheckCircle2, Loader2, Paperclip } from "lucide-react";
import type { FacultyAppraisalPolicy } from "@svgoi/shared-types";

type CriterionState = {
  selectedValue: string;
  points: number;
  remarks: string;
  evidence?: { fileName?: string }[] | null;
};

export function AppraisalSubmitPreviewDialog({
  open,
  policy,
  criteriaState,
  totalPoints,
  incrementPercent,
  submitting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  policy: FacultyAppraisalPolicy | null;
  criteriaState: Record<string, CriterionState>;
  totalPoints: number;
  incrementPercent: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open || !policy) {
    return null;
  }

  const rows = policy.criteria.map((criterion) => {
    const state = criteriaState[criterion.key];
    const option = criterion.options.find(
      (entry) => entry.value === state?.selectedValue,
    );
    return {
      key: criterion.key,
      heading: criterion.heading,
      selectedLabel: option?.label ?? null,
      points: state?.points ?? 0,
      remarks: state?.remarks?.trim() ?? "",
      evidenceCount: state?.evidence?.length ?? 0,
    };
  });

  const unanswered = rows.filter((row) => !row.selectedLabel);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-text/40 px-4 py-6 backdrop-blur-[2px]">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-modal">
        <div className="border-b border-border p-6 pb-4">
          <h2 className="font-display text-xl font-semibold text-text">
            Review before you submit
          </h2>
          <p className="mt-1 text-sm text-text-2">
            Check every criterion below. Once submitted, this appraisal is
            locked and moves to review — you won&apos;t be able to edit it
            here afterward.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-brand-light p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                Total Points
              </p>
              <p className="mt-1 text-2xl font-bold text-brand">
                {totalPoints}
              </p>
            </div>
            <div className="rounded-xl bg-brand-light p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                Max Points
              </p>
              <p className="mt-1 text-2xl font-bold text-brand">
                {policy.maxPoints}
              </p>
            </div>
            <div className="rounded-xl bg-brand-light p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                Expected Increment
              </p>
              <p className="mt-1 text-2xl font-bold text-brand">
                {incrementPercent}%
              </p>
            </div>
          </div>

          {unanswered.length > 0 ? (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {unanswered.length} criterion
                {unanswered.length > 1 ? "a" : ""} left unanswered:{" "}
                {unanswered.map((row) => row.heading).join(", ")}. These will
                be submitted with 0 points unless you go back and complete
                them.
              </span>
            </div>
          ) : (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success-bg px-4 py-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Every criterion has a selected value.</span>
            </div>
          )}

          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.key}
                className="rounded-xl border border-border bg-surface-2 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-text">
                    {row.heading}
                  </p>
                  <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand">
                    {row.points} pt{row.points === 1 ? "" : "s"}
                  </span>
                </div>
                <p
                  className={`mt-1 text-sm ${
                    row.selectedLabel ? "text-text-2" : "text-warning"
                  }`}
                >
                  {row.selectedLabel ?? "Not answered"}
                </p>
                {row.remarks ? (
                  <p className="mt-1 text-xs italic text-text-3">
                    &ldquo;{row.remarks}&rdquo;
                  </p>
                ) : null}
                {row.evidenceCount > 0 ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-text-3">
                    <Paperclip className="h-3 w-3" />
                    {row.evidenceCount} evidence file
                    {row.evidenceCount > 1 ? "s" : ""} attached
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border p-6 pt-4">
          <p className="mb-3 text-sm font-medium text-text">
            Are you sure you want to submit this appraisal?
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="h-9 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Submitting..." : "Yes, submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
