"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Eye, Loader2, Search } from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function getStatusBadge(status: string) {
  if (status === "FULLY_APPROVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Fully Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
      <Clock className="h-3.5 w-3.5" />
      Pending HR Review
    </span>
  );
}

function HrAppraisalsPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycleToggle, setCycleToggle] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
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
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.hr.getTeamAppraisals(
          cycleToggle === "all" ? "all" : undefined,
        );
        if (!active) return;
        setAppraisals(response.data ?? []);
        setDeptFilter("");
        setCycleFilter("");
        setSearch("");
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
    return () => { active = false; };
  }, [cycleToggle]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appraisals.filter((a) => {
      if (deptFilter && a.user?.department?.id !== deptFilter) return false;
      if (cycleFilter && a.cycle?.id !== cycleFilter) return false;
      if (q) {
        const name = `${a.user?.firstName ?? ""} ${a.user?.lastName ?? ""} ${a.user?.email ?? ""}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [appraisals, search, deptFilter, cycleFilter]);

  const pending = useMemo(() => filtered.filter((a) => a.status === "HR_FINALIZED"), [filtered]);
  const approved = useMemo(() => filtered.filter((a) => a.status === "FULLY_APPROVED"), [filtered]);

  function AppraisalRow({ appraisal, viewOnly }: { appraisal: any; viewOnly: boolean }) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-text-2">{appraisal.user?.department?.name ?? "—"}</div>
          <div className="mt-1 font-semibold text-text">
            {appraisal.user?.firstName} {appraisal.user?.lastName}
          </div>
          <div className="mt-0.5 text-xs text-text-3">{appraisal.user?.email}</div>
          <div className="mt-1 text-xs text-text-3">Cycle: {appraisal.cycle?.name ?? "—"}</div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(appraisal.status)}
          <Link
            href={`/hr-review/${appraisal.id}/review`}
            className={
              viewOnly
                ? "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-2 transition hover:bg-surface-2"
                : "inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-dark"
            }
          >
            <Eye className="h-4 w-4" />
            {viewOnly ? "View" : "Review"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader title="HR Appraisals" subtitle="Finalize appraisals that have completed committee review" />

      {/* Cycle toggle + filters */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-2">Showing:</span>
          <div className="flex rounded-lg border border-border bg-surface p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setCycleToggle("active")}
              className={`rounded-md px-3 py-1.5 transition ${cycleToggle === "active" ? "bg-brand text-white shadow-sm" : "text-text-2 hover:text-text"}`}
            >
              Active Cycle
            </button>
            <button
              type="button"
              onClick={() => setCycleToggle("all")}
              className={`rounded-md px-3 py-1.5 transition ${cycleToggle === "all" ? "bg-brand text-white shadow-sm" : "text-text-2 hover:text-text"}`}
            >
              All Cycles
            </button>
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
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              aria-label="Filter by cycle"
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text"
            >
              <option value="">All Cycles</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading appraisals...</span>
          </div>
        </div>
      ) : (
        <>
          {error ? (
            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">{error}</div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-12 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-text-3" />
              <p className="mt-3 text-sm font-medium text-text">No appraisals found</p>
              <p className="mt-1 text-sm text-text-2">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-text">Pending HR Review</h2>
                  {pending.length > 0 && (
                    <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">{pending.length}</span>
                  )}
                </div>
                {pending.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-2">No appraisals pending HR review.</div>
                ) : (
                  <div className="grid gap-4">
                    {pending.map((a) => <AppraisalRow key={a.id} appraisal={a} viewOnly={false} />)}
                  </div>
                )}
              </section>

              {approved.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold text-text">Fully Approved</h2>
                    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text-3">{approved.length}</span>
                  </div>
                  <p className="mb-4 text-sm text-text-2">These appraisals have been fully approved and are read-only.</p>
                  <div className="grid gap-4">
                    {approved.map((a) => <AppraisalRow key={a.id} appraisal={a} viewOnly={true} />)}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

export default withAuth(HrAppraisalsPage, ["HR", "ADMIN"]);
