// apps/web/src/components/auth/withAuth.tsx
"use client";

import { useEffect, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { resolveFacultyGuardRedirect } from "@/lib/faculty-access";
import type { UiRole } from "@/lib/utils/routing";

const DEFAULT_ALLOWED = [
  "FACULTY",
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
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);

    useEffect(() => {
      let active = true;

      async function enforceAccess() {
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
          return;
        }

        const redirect = await resolveFacultyGuardRedirect(
          session.user.roles,
          pathname || "/",
        );

        if (active && redirect) {
          router.replace(redirect);
          return;
        }

        if (active) {
          setIsCheckingAccess(false);
        }
      }

      setIsCheckingAccess(true);
      void enforceAccess();

      return () => {
        active = false;
      };
    }, [allowedRoles, isHydrated, pathname, router, session]);

    if (!isHydrated || !session || isCheckingAccess) {
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
