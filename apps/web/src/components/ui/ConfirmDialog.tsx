// apps/web/src/components/ui/ConfirmDialog.tsx
"use client";

import type { ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  variant = "default",
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "default" | "danger";
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-text/40 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-modal">
        <h2 className="font-display text-xl font-semibold text-text">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-2">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 rounded-lg px-4 text-sm font-medium text-text-inv shadow-sm transition ${
              variant === "danger"
                ? "bg-danger hover:bg-red-700"
                : "bg-brand hover:bg-brand-dark"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
