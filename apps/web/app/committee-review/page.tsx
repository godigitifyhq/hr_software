"use client";

import { useEffect, useMemo, useState } from "react";
import { useFilterData } from "@/hooks/useFilterData";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, Loader2, Search } from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

interface AppraisalForReview {
  id: string;
  status: string;
  cycle: { id: string; name: string; startDate: string; endDate: string };
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    department?: { id: string; name: string } | null;
  };
  submittedAt: string;
  finalScore: number | null;
  totalSelectedPoints: number;
  itemsCount: number;
  callerCategory?: string | null;
  categoryApprovals?: Array<{
    category: string;
    label: string;
    approved: boolean;
  }>;
}

const ACTIVE_STATUSES = ["COMMITTEE_REVIEW"];

function getStatusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    COMMITTEE_REVIEW: { bg: "bg-blue-100", text: "text-blue-800", label: "Pending Review", icon: <AlertCircle className="h-3.5 w-3.5" /> },
    HOD_REVIEW: { bg: "bg-yellow-100", text: "text-yellow-800", label: "HOD Review", icon: <AlertCircle className="h-3.5 w-3.5" /> },
    HR_FINALIZED: { bg: "bg-green-100", text: "text-green-800", label: "Submitted to HR", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    ADMIN_REVIEW: { bg: "bg-orange-100", text: "text-orange-800", label: "Pending Admin", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    FULLY_APPROVED: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Fully Approved", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  };
  const badge = map[status] ?? map.COMMITTEE_REVIEW;
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full ${badge.bg} ${badge.text} px-3 py-1 text-xs font-semibold uppercase tracking-wider`}>
      {badge.icon}
      {badge.label}
    </div>
  );
}

function CommitteeDashboardPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const { toast } = useToast();

  const [appraisals, setAppraisals] = useState<AppraisalForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycleToggle, setCycleToggle] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const { departments, cycles } = useFilterData();

  useEffect(() => {
    let active = true;
    async function loadAppraisals() {
      try {
        setLoading(true);
        const response = await api.committee.getTeamAppraisals(
          cycleToggle === "all" ? "all" : undefined,
        );
        if (active) {
          setAppraisals(response.data as unknown as AppraisalForReview[]);
          setDeptFilter("");
          setCycleFilter("");
          setSearch("");
        }
      } catch (loadError: any) {
        if (active)
          toast({
            title: "Error",
            description:
              loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load appraisals for review",
            variant: "error",
          });
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAppraisals();
    return () => { active = false; };
  }, [cycleToggle]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appraisals.filter((a) => {
      if (deptFilter && a.user?.department?.id !== deptFilter) return false;
      if (cycleFilter && a.cycle?.id !== cycleFilter) return false;
      if (q) {
        const name = `${a.user.firstName} ${a.user.lastName} ${a.user.email}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [appraisals, search, deptFilter, cycleFilter]);

  const pending = useMemo(() => filtered.filter((a) => ACTIVE_STATUSES.includes(a.status)), [filtered]);
  const reviewed = useMemo(() => filtered.filter((a) => !ACTIVE_STATUSES.includes(a.status)), [filtered]);

  function AppraisalCard({ appraisal, viewOnly }: { appraisal: AppraisalForReview; viewOnly: boolean }) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-start gap-2">
              <div>
                <h4 className="font-semibold text-text">{appraisal.user.firstName} {appraisal.user.lastName}</h4>
                <p className="mt-0.5 text-xs text-text-3">{appraisal.user.email}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-bg p-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-3">Department</p>
                <p className="mt-1 text-sm font-medium text-text">{appraisal.user.department?.name ?? "Not assigned"}</p>
              </div>
              <div className="rounded-lg bg-bg p-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-3">Cycle</p>
                <p className="mt-1 text-sm font-medium text-text">{appraisal.cycle.name}</p>
              </div>
              <div className="rounded-lg bg-bg p-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
                  {appraisal.callerCategory
                    ? `${appraisal.callerCategory.charAt(0)}${appraisal.callerCategory
                        .slice(1)
                        .toLowerCase()} Points`
                    : "Total Points"}
                </p>
                <p className="mt-1 text-sm font-medium text-text">
                  {appraisal.totalSelectedPoints ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-bg p-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-3">Status</p>
                <div className="mt-1">{getStatusBadge(appraisal.status)}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(
                appraisal.categoryApprovals ?? [
                  { category: "ACADEMICS", label: "Academics", approved: false },
                  { category: "RESEARCH", label: "Research", approved: false },
                  { category: "OTHERS", label: "Others", approved: false },
                ]
              ).map((c) => (
                <span
                  key={c.category}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    c.approved
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                      : "border-border bg-surface-2 text-text-2"
                  }`}
                >
                  {c.approved ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <span className="h-2 w-2 rounded-full border-2 border-text-3" />
                  )}
                  {c.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-3">Submitted: {new Date(appraisal.submittedAt).toLocaleDateString()}</p>
          </div>
          <Link
            href={`/committee-review/${appraisal.id}/review`}
            className={
              viewOnly
                ? "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-2 transition hover:bg-surface-2"
                : "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
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
      <PageHeader title="Committee Review Dashboard" subtitle="Review and approve faculty appraisals submitted by HOD" />

      {/* Cycle toggle + filters */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-2">Showing:</span>
          <div className="flex rounded-lg border border-border bg-surface p-1 text-xs font-medium">
            <button type="button" onClick={() => setCycleToggle("active")} className={`rounded-md px-3 py-1.5 transition ${cycleToggle === "active" ? "bg-brand text-white shadow-sm" : "text-text-2 hover:text-text"}`}>Active Cycle</button>
            <button type="button" onClick={() => setCycleToggle("all")} className={`rounded-md px-3 py-1.5 transition ${cycleToggle === "all" ? "bg-brand text-white shadow-sm" : "text-text-2 hover:text-text"}`}>All Cycles</button>
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
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text"
            >
              <option value="">All Cycles</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-6">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
          <span className="text-sm text-text-2">Loading appraisals...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-text-3" />
          <h3 className="mt-3 font-display text-lg font-semibold text-text">No appraisals found</h3>
          <p className="mt-1 text-sm text-text-2">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-text">Pending Review</h2>
              {pending.length > 0 && <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">{pending.length}</span>}
            </div>
            {pending.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-2">No appraisals pending committee review.</div>
            ) : (
              <div className="grid gap-4">{pending.map((a) => <AppraisalCard key={a.id} appraisal={a} viewOnly={false} />)}</div>
            )}
          </section>

          {reviewed.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold text-text">Committee Review Submitted</h2>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text-3">{reviewed.length}</span>
              </div>
              <p className="mb-4 text-sm text-text-2">These appraisals have been reviewed and forwarded to HR. They are read-only.</p>
              <div className="grid gap-4">{reviewed.map((a) => <AppraisalCard key={a.id} appraisal={a} viewOnly={true} />)}</div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

export default withAuth(CommitteeDashboardPage, [
  "COMMITTEE",
  "COMMITTEE_ACADEMIC",
  "COMMITTEE_RESEARCH",
  "COMMITTEE_OTHER",
]);
