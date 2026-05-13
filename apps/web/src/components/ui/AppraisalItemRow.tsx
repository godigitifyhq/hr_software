// apps/web/src/components/ui/AppraisalItemRow.tsx
"use client";

import { ScoreSegment } from "@/components/ui/ScoreSegment";

export type AppraisalItemView = {
  id: string;
  label?: string;
  key?: string;
  weight: number;
  selfScore?: number | null;
  hodScore?: number | null;
  committeeScore?: number | null;
  points?: number | null;
  notes?: string | null;
};

type Mode = "self" | "hod" | "committee" | "view";

type AppraisalItemRowProps = {
  item: AppraisalItemView;
  mode: Mode;
  onChange?: (patch: Partial<AppraisalItemView>) => void;
  notesValue?: string;
  onNotesChange?: (value: string) => void;
  error?: string;
};

export function AppraisalItemRow({
  item,
  mode,
  onChange,
  notesValue,
  onNotesChange,
  error,
}: AppraisalItemRowProps) {
  const score =
    mode === "self"
      ? item.points ?? null
      : mode === "hod"
      ? item.hodScore ?? null
      : mode === "committee"
      ? item.committeeScore ?? null
      : item.selfScore ?? item.points ?? null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-border-strong">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-text">
              {item.label ?? item.key ?? "Appraisal item"}
            </h3>
            <span className="rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-text-2">
              Weight: {(item.weight * 100).toFixed(0)}%
            </span>
          </div>
          <p className="mt-1 text-sm text-text-2">
            Use the score controls below to capture the current review stage.
          </p>
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-2">
          <span className="rounded-md bg-surface-2 px-2 py-1">
            Self: {item.selfScore ?? "—"}
          </span>
          <span className="rounded-md bg-surface-2 px-2 py-1">
            HOD: {item.hodScore ?? "—"}
          </span>
          <span className="rounded-md bg-surface-2 px-2 py-1">
            Committee: {item.committeeScore ?? "—"}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <ScoreSegment
          value={score}
          readonly={mode === "view"}
          onChange={(value) => onChange?.({ points: value })}
          ariaLabel={`${item.label ?? item.key ?? "Item"} score`}
        />
        <span className="text-sm text-text-2">
          {mode === "self"
            ? "Your score"
            : mode === "hod"
            ? "HOD score"
            : mode === "committee"
            ? "Committee score"
            : "Read only"}
        </span>
      </div>

      {mode !== "view" ? (
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-text">
            Comment
          </label>
          <textarea
            value={notesValue ?? item.notes ?? ""}
            onChange={(event) => onNotesChange?.(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand focus:ring-4 focus:ring-brand/10"
            placeholder="Add context or justification"
          />
        </div>
      ) : null}
    </div>
  );
}
