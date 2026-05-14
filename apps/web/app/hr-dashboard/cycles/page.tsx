"use client";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { withAuth } from "@/components/auth/withAuth";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function HrCyclesPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  return (
    <AppShell role={role}>
      <PageHeader
        title="Cycles"
        subtitle="Track appraisal cycles and timelines."
      />
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-2">
        Cycle management will appear here.
      </div>
    </AppShell>
  );
}

export default withAuth(HrCyclesPage, ["HR", "ADMIN", "SUPER_ADMIN"]);
