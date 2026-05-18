"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";
import type { AppraisalStatus } from "@svgoi/shared-types";

type HodRequestSummary = {
  id: string;
  status: AppraisalStatus;
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

const PENDING_STATUSES = ["SUBMITTED", "HOD_REVIEW"];

function HodDashboardPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [requests, setRequests] = useState<HodRequestSummary[]>([]);
  const [selfStatus, setSelfStatus] = useState<{
    hasRequest?: boolean;
    appraisalId?: string;
    status?: string;
    totalPoints?: number | null;
    incrementPercent?: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycleFilter, setCycleFilter] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [cycleIdFilter, setCycleIdFilter] = useState("");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [cycles, setCycles] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [deptsRes, cyclesRes] = await Promise.all([
          api.departments.list(),
          api.appraisals.getCycles(),
        ]);
        setDepartments(deptsRes.data ?? []);
        setCycles(cyclesRes.data ?? []);
      } catch {
        // non-critical
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const [requestResponse, selfResponse] = await Promise.all([
          api.hod.getFacultyRequests(cycleFilter === "all" ? "all" : undefined),
          api.faculty.getAppraisalStatus(),
        ]);

        if (!active) {
          return;
        }

        setRequests((requestResponse.data ?? []) as HodRequestSummary[]);
        setSelfStatus(selfResponse.data as any);
        setDeptFilter("");
        setCycleIdFilter("");
        setSearch("");
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
  }, [cycleFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (deptFilter && r.user?.department?.id !== deptFilter) return false;
      if (cycleIdFilter && r.cycle?.id !== cycleIdFilter) return false;
      if (q) {
        const name = `${r.user.firstName} ${r.user.lastName} ${r.user.email}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [requests, search, deptFilter, cycleIdFilter]);

  const pending = useMemo(
    () => filtered.filter((r) => PENDING_STATUSES.includes(r.status)),
    [filtered],
  );
  const reviewed = useMemo(
    () => filtered.filter((r) => !PENDING_STATUSES.includes(r.status)),
    [filtered],
  );

  function RequestCard({
    request,
    viewOnly,
  }: {
    request: HodRequestSummary;
    viewOnly: boolean;
  }) {
    return (
      <article className="rounded-xl border border-border bg-bg p-4">
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
            <StatusBadge status={request.status} />
            {viewOnly ? (
              <Link
                href={`/hod-review/review/${request.id}`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition hover:bg-surface-2"
              >
                <Eye className="h-4 w-4" />
                View
              </Link>
            ) : (
              <Link
                href={`/hod-review/review/${request.id}`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition hover:bg-surface-2"
              >
                <ClipboardCheck className="h-4 w-4" />
                Review
              </Link>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="HOD Dashboard"
        subtitle="Review faculty appraisal requests and manage your own appraisal request."
        actions={
          selfStatus?.hasRequest ? (
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-success/20 bg-success-bg px-4 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" />
                Self Appraisal Submitted
              </div>
              {selfStatus.appraisalId ? (
                <Link
                  href={`/faculty-dashboard/appraisals/${selfStatus.appraisalId}/view`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
                >
                  <FileText className="h-4 w-4" />
                  View
                </Link>
              ) : null}
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

          {/* Cycle toggle + filters */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-2">Showing:</span>
              <div className="flex rounded-lg border border-border bg-surface p-1 text-xs font-medium">
                <button type="button" onClick={() => setCycleFilter("active")} className={`rounded-md px-3 py-1.5 transition ${cycleFilter === "active" ? "bg-brand text-white shadow-sm" : "text-text-2 hover:text-text"}`}>Active Cycle</button>
                <button type="button" onClick={() => setCycleFilter("all")} className={`rounded-md px-3 py-1.5 transition ${cycleFilter === "all" ? "bg-brand text-white shadow-sm" : "text-text-2 hover:text-text"}`}>All Cycles</button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-bg pl-9 pr-3 text-sm text-text placeholder:text-text-3"
                  />
                </div>
                <select
                  aria-label="Filter by department"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select
                  aria-label="Filter by cycle"
                  value={cycleIdFilter}
                  onChange={(e) => setCycleIdFilter(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text"
                >
                  <option value="">All Cycles</option>
                  {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Total Faculty Requests
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
                {pending.length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Your Self Request
              </p>
              {selfStatus?.hasRequest ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-text">
                    {selfStatus.status?.replace(/_/g, " ")} &middot; {selfStatus.totalPoints ?? 0} pts &middot; {selfStatus.incrementPercent ?? 0}%
                  </p>
                  {selfStatus.appraisalId ? (
                    <Link
                      href={`/faculty-dashboard/appraisals/${selfStatus.appraisalId}/view`}
                      className="shrink-0 text-xs font-semibold text-brand hover:text-brand-dark"
                    >
                      View
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-sm font-medium text-text">Not submitted</p>
              )}
            </div>
          </div>

          {/* Pending Review */}
          <section className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-brand" />
              <h2 className="font-display text-xl font-semibold text-text">
                Pending Review
              </h2>
              {pending.length > 0 && (
                <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
                  {pending.length}
                </span>
              )}
            </div>

            {pending.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg p-6 text-sm text-text-2">
                No faculty appraisals are pending HOD review.
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((request) => (
                  <RequestCard key={request.id} request={request} viewOnly={false} />
                ))}
              </div>
            )}
          </section>

          {/* Reviewed / Submitted */}
          {reviewed.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-text-3" />
                <h2 className="font-display text-xl font-semibold text-text">
                  HOD Review Submitted
                </h2>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text-3">
                  {reviewed.length}
                </span>
              </div>
              <p className="mb-4 text-sm text-text-2">
                These appraisals have been reviewed by you and forwarded to the
                next stage. They are read-only.
              </p>
              <div className="space-y-3">
                {reviewed.map((request) => (
                  <RequestCard key={request.id} request={request} viewOnly={true} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}

export default withAuth(HodDashboardPage, ["HOD"]);
