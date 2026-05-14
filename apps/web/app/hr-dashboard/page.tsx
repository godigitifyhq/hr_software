"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

type HrRequestSummary = {
  id: string;
  status: string;
  submittedAt?: string | null;
  finalScore?: number | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    department?: { id: string; name: string } | null;
  };
  cycle: { id: string; name: string };
  totalSelectedPoints: number;
  itemsCount: number;
};

function HrDashboardPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [requests, setRequests] = useState<HrRequestSummary[]>([]);
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
        setRequests(response.data ?? []);
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load HR dashboard",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const pendingCount = useMemo(
    () =>
      requests.filter(
        (r) => r.status === "HR_FINALIZED" || r.status === "COMMITTEE_REVIEW",
      ).length,
    [requests],
  );

  return (
    <AppShell role={role}>
      <PageHeader
        title="HR Dashboard"
        subtitle="Review committee-finalized appraisals and manage employee records."
        actions={undefined}
      />

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading HR dashboard...</span>
          </div>
        </div>
      ) : (
        <>
          {error ? (
            <div className="mb-6 rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Total Appraisals
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-text">
                {requests.length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Pending Review
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-text">
                {pendingCount}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Finalized
              </p>
              <p className="mt-2 text-sm font-medium text-text">
                {requests.filter((r) => r.status === "CLOSED").length} closed
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-brand" />
              <h2 className="font-display text-xl font-semibold text-text">
                Appraisals for HR
              </h2>
            </div>

            {requests.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg p-6 text-sm text-text-2">
                No appraisals available for HR review.
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-xl border border-border bg-bg p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-text">
                          {request.user.firstName} {request.user.lastName}
                        </p>
                        <p className="text-xs text-text-2">
                          {request.user.email}
                        </p>
                        <p className="mt-1 text-xs text-text-3">
                          {request.cycle.name} | {request.itemsCount} criteria |{" "}
                          {request.totalSelectedPoints} selected points
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
                          {request.status}
                        </span>
                        <Link
                          href={`/hr-review/${request.id}/review`}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition hover:bg-surface-2"
                        >
                          Review
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

export default withAuth(HrDashboardPage, ["HR"]);
