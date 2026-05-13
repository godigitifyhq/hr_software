// apps/web/src/components/layout/Topbar.tsx
"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, Search } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { AvatarInitials } from "@/components/ui/AvatarInitials";

function labelForSegment(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const items = ["Home"];

    segments.forEach((segment, index) => {
      if (segment === "appraisals" && index === 0) {
        items.push("Appraisals");
        return;
      }

      items.push(labelForSegment(segment));
    });

    return items.join(" › ");
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Keep local logout behavior even if the request fails.
    } finally {
      logout();
      router.push("/login");
    }
  };

  const displayName = session
    ? `${session.user.firstName} ${session.user.lastName}`
    : "Guest";
  const role = session ? getPrimaryRole(session.user.roles) : "EMPLOYEE";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-surface px-4 shadow-xs sm:px-6">
      <div className="flex w-full items-center gap-4">
        <div className="min-w-0 flex-1 text-sm text-text-2">
          <span className="truncate">{breadcrumbs}</span>
        </div>

        <button
          type="button"
          className="hidden h-9 w-[240px] items-center gap-2 rounded-full border border-transparent bg-surface-2 px-4 text-sm text-text-3 transition hover:border-border hover:bg-surface-3 md:flex"
        >
          <Search className="h-4 w-4" />
          <span>Search...</span>
        </button>

        <button
          type="button"
          className="rounded-full p-2 text-text-2 transition hover:bg-surface-2 hover:text-text"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex items-center gap-3 rounded-full border border-border bg-surface px-2 py-1.5 pr-3 text-left shadow-xs transition hover:bg-surface-2"
          >
            <AvatarInitials name={displayName} size={28} />
            <div className="hidden sm:block">
              <div className="text-sm font-medium text-text">{displayName}</div>
              <div className="text-xs text-text-3">{role}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-text-3" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] w-56 rounded-2xl border border-border bg-surface p-2 shadow-modal">
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-text-2 transition hover:bg-surface-2 hover:text-text"
              >
                Profile
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-danger transition hover:bg-danger-bg"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
