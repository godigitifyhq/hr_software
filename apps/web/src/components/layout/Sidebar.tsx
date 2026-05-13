// apps/web/src/components/layout/Sidebar.tsx
"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Shield,
  Users,
  Building2,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getPrimaryRole, type UiRole } from "@/lib/utils/routing";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

const ROLE_NAV: Record<string, { title: string; items: NavItem[] }> = {
  FACULTY: {
    title: "Faculty",
    items: [
      { label: "Dashboard", href: "/faculty-dashboard", icon: LayoutDashboard },
      {
        label: "Request Appraisal",
        href: "/faculty-dashboard/request-appraisal",
        icon: ClipboardList,
      },
      { label: "My Profile", href: "/profile", icon: FileText },
    ],
  },
  EMPLOYEE: {
    title: "Employee",
    items: [
      { label: "My Appraisals", href: "/appraisals", icon: ClipboardList },
      { label: "My Profile", href: "/profile", icon: FileText },
    ],
  },
  HOD: {
    title: "HOD",
    items: [
      { label: "My Department", href: "/hod-review", icon: Building2 },
      { label: "My Profile", href: "/profile", icon: FileText },
    ],
  },
  COMMITTEE: {
    title: "Committee",
    items: [
      { label: "Assigned Reviews", href: "/committee-review", icon: Shield },
      { label: "My Profile", href: "/profile", icon: FileText },
    ],
  },
  HR: {
    title: "HR",
    items: [
      { label: "Overview", href: "/hr-dashboard", icon: LayoutDashboard },
      { label: "Employees", href: "/hr-dashboard/employees", icon: Users },
      {
        label: "Departments",
        href: "/hr-dashboard/departments",
        icon: Building2,
      },
      { label: "Cycles", href: "/hr-dashboard/cycles", icon: ClipboardList },
      {
        label: "All Submissions",
        href: "/hr-dashboard/submissions",
        icon: FileText,
      },
      { label: "Audit Log", href: "/hr-dashboard/audit", icon: Shield },
    ],
  },
  ADMIN: {
    title: "Admin",
    items: [
      { label: "Overview", href: "/hr-dashboard", icon: LayoutDashboard },
      { label: "Employees", href: "/hr-dashboard/employees", icon: Users },
      {
        label: "Departments",
        href: "/hr-dashboard/departments",
        icon: Building2,
      },
      { label: "Cycles", href: "/hr-dashboard/cycles", icon: ClipboardList },
      {
        label: "All Submissions",
        href: "/hr-dashboard/submissions",
        icon: FileText,
      },
      { label: "Audit Log", href: "/hr-dashboard/audit", icon: Shield },
      {
        label: "System Settings",
        href: "/hr-dashboard/settings",
        icon: Settings2,
      },
    ],
  },
  SUPER_ADMIN: {
    title: "Admin",
    items: [
      { label: "Overview", href: "/hr-dashboard", icon: LayoutDashboard },
      { label: "Employees", href: "/hr-dashboard/employees", icon: Users },
      {
        label: "Departments",
        href: "/hr-dashboard/departments",
        icon: Building2,
      },
      { label: "Cycles", href: "/hr-dashboard/cycles", icon: ClipboardList },
      {
        label: "All Submissions",
        href: "/hr-dashboard/submissions",
        icon: FileText,
      },
      { label: "Audit Log", href: "/hr-dashboard/audit", icon: Shield },
      {
        label: "System Settings",
        href: "/hr-dashboard/settings",
        icon: Settings2,
      },
    ],
  },
};

export function Sidebar({
  role,
  currentPath,
}: {
  role?: UiRole | string;
  currentPath?: string;
}) {
  const pathname = usePathname();
  const { session } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("sidebar-collapsed");
    if (stored) {
      setCollapsed(stored === "1");
    }
  }, []);

  const resolvedRole = useMemo(() => {
    const sessionRole = getPrimaryRole(session?.user.roles ?? []);
    return (role ?? sessionRole) as UiRole;
  }, [role, session?.user.roles]);

  const nav = ROLE_NAV[resolvedRole] ?? ROLE_NAV.EMPLOYEE;
  const path = currentPath ?? pathname;

  const toggle = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-border bg-surface transition-all duration-200 ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div
          className={`flex items-center gap-2 ${
            collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <span className="font-display text-lg font-semibold tracking-tight text-text">
            SVGOI
          </span>
          <span className="rounded-md bg-brand-light px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand">
            {nav.title}
          </span>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="rounded-lg border border-border bg-surface-2 p-1.5 text-text-2 transition hover:bg-surface-3"
          aria-label="Toggle sidebar"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <div
          className={`px-3 text-[11px] font-semibold uppercase tracking-widest text-text-3 ${
            collapsed ? "sr-only" : ""
          }`}
        >
          Navigation
        </div>
        <div className="mt-3 space-y-1">
          {nav.items.map((item) => {
            const active = path?.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                  active
                    ? "bg-brand-light text-brand"
                    : "text-text-2 hover:bg-bg hover:text-text"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
