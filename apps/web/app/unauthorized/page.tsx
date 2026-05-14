import { Suspense } from "react";
import UnauthorizedContent from "./unauthorized-content";

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<UnauthorizedFallback />}>
      <UnauthorizedContent />
    </Suspense>
  );
}

function UnauthorizedFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-8 text-center shadow-modal">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-danger-bg" />
        <h1 className="mt-5 font-display text-2xl font-semibold text-text">
          Not authorized
        </h1>
      </div>
    </div>
  );
}
