"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Users,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

type HodRequestSummary = {
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
  cycle: {
    id: string;
    name: string;
  };
  totalSelectedPoints: number;
  itemsCount: number;
};

function HodDashboardPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [requests, setRequests] = useState<HodRequestSummary[]>([]);
  const [selfStatus, setSelfStatus] = useState<{
    hasRequest?: boolean;
    status?: string;
    totalPoints?: number | null;
    incrementPercent?: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const [requestResponse, selfResponse] = await Promise.all([
          api.hod.getFacultyRequests(),
          api.faculty.getAppraisalStatus(),
        ]);

        if (!active) {
          return;
        }

        setRequests((requestResponse.data ?? []) as HodRequestSummary[]);
        setSelfStatus(selfResponse.data as any);
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load HOD dashboard",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const pendingCount = useMemo(
    () => requests.filter((entry) => entry.status === "SUBMITTED").length,
    [requests],
  );

  return (
    <AppShell role={role}>
      <PageHeader
        title="HOD Dashboard"
        subtitle="Review faculty appraisal requests and manage your own appraisal request."
        actions={
          selfStatus?.hasRequest ? (
            <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-success/20 bg-success-bg px-4 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Self Appraisal Requested
            </div>
          ) : (
            <Link
              href="/hod-review/request-appraisal"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
            >
              Request Self Appraisal
              <ArrowRight className="h-4 w-4" />
            </Link>
          )
        }
      />

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading HOD dashboard...</span>
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
                Faculty Requests
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
                Your Self Request
              </p>
              <p className="mt-2 text-sm font-medium text-text">
                {selfStatus?.hasRequest
                  ? `${selfStatus.status} (${selfStatus.totalPoints ?? 0} pts)`
                  : "Not submitted"}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-brand" />
              <h2 className="font-display text-xl font-semibold text-text">
                Faculty Appraisal Requests
              </h2>
            </div>

            {requests.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg p-6 text-sm text-text-2">
                No faculty appraisal requests are pending in your department.
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
                        <p className="text-xs text-text-2">{request.user.email}</p>
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
                          href={`/hod-review/review/${request.id}`}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition hover:bg-surface-2"
                        >
                          <ClipboardCheck className="h-4 w-4" />
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

export default withAuth(HodDashboardPage, ["HOD"]);
