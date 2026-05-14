"use client";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { withAuth } from "@/components/auth/withAuth";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function HrEmployeesPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  return (
    <AppShell role={role}>
      <PageHeader
        title="Employees"
        subtitle="Legacy route: use Faculty for current navigation."
      />
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-2">
        This page exists for backward compatibility. Use the Faculty section.
      </div>
    </AppShell>
  );
}

export default withAuth(HrEmployeesPage, ["HR", "ADMIN", "SUPER_ADMIN"]);
