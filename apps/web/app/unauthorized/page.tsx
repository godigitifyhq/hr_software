// apps/web/app/unauthorized/page.tsx
"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-8 text-center shadow-modal">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-bg text-danger">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-text">
          Not authorized
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-2">
          Your current account does not have permission to view this area.
        </p>
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
