// apps/web/app/unauthorized/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";

const UNAUTHORIZED_REASON_TEXT: Record<string, string> = {
  "missing-role":
    "Your account does not include the role required for this page.",
  "profile-role":
    "This page is available only to faculty, employee, or HOD accounts.",
  unknown: "Your current account does not have permission to view this area.",
};

function parseRoleList(raw: string | null) {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

export default function UnauthorizedPage() {
  const searchParams = useSearchParams();
  const reasonKey = searchParams.get("reason") || "unknown";
  const reasonText =
    UNAUTHORIZED_REASON_TEXT[reasonKey] ?? UNAUTHORIZED_REASON_TEXT.unknown;
  const requiredRoles = parseRoleList(searchParams.get("required"));
  const currentRoles = parseRoleList(searchParams.get("current"));
  const attemptedPath = searchParams.get("path");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-8 text-center shadow-modal">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-bg text-danger">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-text">
          Not authorized
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-2">{reasonText}</p>
        <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-left text-xs text-text-2">
          <p>
            <span className="font-semibold text-text">Reason:</span> {reasonKey}
          </p>
          {attemptedPath ? (
            <p className="mt-1">
              <span className="font-semibold text-text">Requested page:</span>{" "}
              {attemptedPath}
            </p>
          ) : null}
          {requiredRoles.length > 0 ? (
            <p className="mt-1">
              <span className="font-semibold text-text">Required role(s):</span>{" "}
              {requiredRoles.join(", ")}
            </p>
          ) : null}
          <p className="mt-1">
            <span className="font-semibold text-text">Your role(s):</span>{" "}
            {currentRoles.length > 0 ? currentRoles.join(", ") : "None"}
          </p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
          >
            Go home
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
