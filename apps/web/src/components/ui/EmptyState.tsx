// apps/web/src/components/ui/EmptyState.tsx
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
      {icon ? <div className="mb-4 text-text-3">{icon}</div> : null}
      <h3 className="text-base font-medium text-text-2">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-text-3">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
