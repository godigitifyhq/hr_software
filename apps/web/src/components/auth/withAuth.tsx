// apps/web/src/components/auth/withAuth.tsx
"use client";

import { useEffect, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import type { UiRole } from "@/lib/utils/routing";

const DEFAULT_ALLOWED = [
  "EMPLOYEE",
  "HOD",
  "COMMITTEE",
  "HR",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export function withAuth<P extends object>(
  Component: ComponentType<P>,
  allowedRoles: UiRole[] = [...DEFAULT_ALLOWED],
) {
  function ProtectedComponent(props: P) {
    const router = useRouter();
    const pathname = usePathname();
    const { session, isHydrated } = useAuthStore();

    useEffect(() => {
      if (!isHydrated) {
        return;
      }

      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
        return;
      }

      const hasRole = session.user.roles.some((role) =>
        allowedRoles.includes(role as UiRole),
      );
      if (!hasRole) {
        router.replace("/unauthorized");
      }
    }, [isHydrated, pathname, router, session]);

    if (!isHydrated || !session) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg">
          <div className="rounded-2xl border border-border bg-surface px-6 py-5 shadow-sm">
            <div className="flex items-center gap-3 text-text-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-brand" />
              <span className="text-sm">Loading session...</span>
            </div>
          </div>
        </div>
      );
    }

    const hasRole = session.user.roles.some((role) =>
      allowedRoles.includes(role as UiRole),
    );
    if (!hasRole) {
      return null;
    }

    return <Component {...props} />;
  }

  ProtectedComponent.displayName = `withAuth(${
    Component.displayName || Component.name || "Component"
  })`;

  return ProtectedComponent;
}
