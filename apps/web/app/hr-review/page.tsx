"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function HRReviewListPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.hr.getTeamAppraisals();
        if (!active) return;
        setAppraisals(response.data ?? []);
      } catch (err: any) {
        if (active)
          setError(
            err?.response?.data?.message || err?.message || "Failed to load",
          );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <AppShell role={role}>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading HR review list...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="HR Appraisals"
        subtitle="Appraisals awaiting HR review"
      />

      {error ? (
        <div className="mb-4 rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        {appraisals.map((appraisal) => (
          <div
            key={appraisal.id}
            className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex items-center justify-between"
          >
            <div>
              <div className="text-sm text-text-2">
                {appraisal.user?.department?.name ?? "Department"}
              </div>
              <div className="mt-1 font-semibold text-text">
                {appraisal.user?.firstName} {appraisal.user?.lastName}
              </div>
              <div className="text-xs text-text-3">
                Cycle: {appraisal.cycle?.name ?? "-"}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/hr-review/${appraisal.id}/review`}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-dark"
              >
                Review
              </Link>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

export default withAuth(HRReviewListPage, ["HR"]);
