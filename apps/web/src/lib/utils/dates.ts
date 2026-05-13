// apps/web/src/lib/utils/dates.ts
import { format, formatDistanceToNowStrict, isValid } from "date-fns";

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return isValid(date) ? format(date, "MMM d, yyyy") : "—";
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return isValid(date) ? format(date, "MMM d, yyyy · h:mm a") : "—";
}

export function relativeDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return isValid(date)
    ? formatDistanceToNowStrict(date, { addSuffix: true })
    : "—";
}
