"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, type AppraisalSummary } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function CommitteeViewPage() {
  const params = useParams();
  const appraisalId = params.id as string;
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  const [appraisal, setAppraisal] = useState<AppraisalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAppraisal() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.appraisals.getById(appraisalId);

        if (active) {
          setAppraisal(response.data);
        }
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load appraisal details",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (appraisalId) {
      void loadAppraisal();
    }

    return () => {
      active = false;
    };
  }, [appraisalId]);

  const totalPoints = useMemo(
    () =>
      appraisal?.items?.reduce((sum, item) => sum + (item.points ?? 0), 0) ?? 0,
    [appraisal?.items],
  );

  if (loading) {
    return (
      <AppShell role={role}>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading appraisal details...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !appraisal) {
    return (
      <AppShell role={role}>
        <PageHeader
          title="Committee Appraisal Details"
          subtitle="Unable to load appraisal"
          actions={
            <Link
              href="/committee-review"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          }
        />
        <div className="rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>{error || "Appraisal not found"}</div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="Committee Appraisal Details"
        subtitle={`${appraisal.user?.firstName ?? ""} ${
          appraisal.user?.lastName ?? ""
        } | ${appraisal.cycle?.name ?? "Cycle"}`.trim()}
        actions={
          <Link
            href="/committee-review"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Status
          </p>
          <p className="mt-2 font-semibold text-text">
            {appraisal.status.replace(/_/g, " ")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Final Score
          </p>
          <p className="mt-2 font-semibold text-text">
            {appraisal.finalScore ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Total Points
          </p>
          <p className="mt-2 font-semibold text-text">{totalPoints}</p>
        </div>
      </div>

      <div className="space-y-4">
        {(appraisal.items ?? []).map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  {item.key}
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-text">
                  {item.label ?? item.key}
                </h3>
              </div>
              <div className="rounded-full bg-brand-light px-3 py-1 text-sm font-semibold text-brand">
                {item.points ?? 0} pts
              </div>
            </div>
            {item.notes ? (
              <p className="mt-3 rounded-xl bg-bg p-3 text-sm text-text-2">
                {item.notes}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      {appraisal.status === "HR_FINALIZED" ? (
        <div className="mt-6 rounded-2xl border border-success/20 bg-success-bg p-4 text-sm text-success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            This appraisal has already been finalized.
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default withAuth(CommitteeViewPage, ["COMMITTEE"]);
