// apps/web/src/components/ui/AvatarInitials.tsx
import { hashColor, getInitials } from "@/lib/utils/identity";

export function AvatarInitials({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
  const backgroundColor = hashColor(name);
  const initials = getInitials(name);

  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white shadow-xs"
      style={{ width: size, height: size, backgroundColor }}
      aria-hidden="true"
    >
      <span className="text-sm" style={{ fontSize: Math.max(12, size * 0.36) }}>
        {initials}
      </span>
    </div>
  );
}
