// apps/web/src/components/ui/ScoreSegment.tsx
type ScoreSegmentProps = {
  value: number | null;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
};

const scores = [1, 2, 3, 4, 5];

export function ScoreSegment({
  value,
  onChange,
  readonly = false,
  size = "md",
  ariaLabel,
}: ScoreSegmentProps) {
  const buttonClass = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 shadow-xs"
    >
      {scores.map((score) => {
        const selected = value === score;

        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={readonly}
            onClick={() => onChange?.(score)}
            className={`flex items-center justify-center rounded-md border transition ${buttonClass} ${
              selected
                ? "border-brand bg-brand text-text-inv shadow-sm"
                : "border-transparent bg-transparent text-text-2 hover:border-brand hover:bg-brand-light"
            }`}
          >
            {score}
          </button>
        );
      })}
    </div>
  );
}
