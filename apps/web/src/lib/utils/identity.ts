// apps/web/src/lib/utils/identity.ts
const palette = [
  "#1D4ED8",
  "#059669",
  "#7C3AED",
  "#D97706",
  "#DC2626",
  "#0F766E",
  "#2563EB",
  "#475569",
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "SV";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function hashColor(name: string): string {
  const hash = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}
