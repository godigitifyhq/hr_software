"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, DollarSign, Loader2, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { withAuth } from "@/components/auth/withAuth";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

type HrSubmissionSummary = {
  id: string;
  status: string;
  submittedAt?: string | null;
  finalScore?: number | null;
  finalPercent?: number | null;
  currentSalary?: number | null;
  superAdminApprovedPercent?: number | null;
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

function HrSubmissionsPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [reviewSubmissions, setReviewSubmissions] = useState<
    HrSubmissionSummary[]
  >([]);
  const [approvedSubmissions, setApprovedSubmissions] = useState<
    HrSubmissionSummary[]
  >([]);
  const [activeTab, setActiveTab] = useState<"review" | "approved">("review");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [reviewResponse, approvedResponse] = await Promise.all([
          api.hr.getTeamAppraisals(),
          api.hr.getApprovedAppraisals(),
        ]);
        if (!active) return;
        setReviewSubmissions(reviewResponse.data ?? []);
        setApprovedSubmissions(approvedResponse.data ?? []);
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load submissions",
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

  const approvedCount = useMemo(
    () => approvedSubmissions.length,
    [approvedSubmissions],
  );

  const activeSubmissions =
    activeTab === "review" ? reviewSubmissions : approvedSubmissions;

  const averageSalaryIncrease = useMemo(() => {
    if (approvedCount === 0) return 0;
    return (
      approvedSubmissions.reduce(
        (sum, item) =>
          sum + (item.superAdminApprovedPercent ?? item.finalPercent ?? 0),
        0,
      ) / approvedCount
    );
  }, [approvedSubmissions, approvedCount]);

  return (
    <AppShell role={role}>
      <PageHeader
        title="All Submissions"
        subtitle="Review and export appraisal submissions."
      />

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading submissions...</span>
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
                Ready for HR Review
              </p>
              <p className="mt-2 text-3xl font-bold text-text">
                {reviewSubmissions.length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Fully Approved
              </p>
              <p className="mt-2 text-3xl font-bold text-success">
                {approvedCount}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Average Salary Increase %
              </p>
              <p className="mt-2 text-3xl font-bold text-brand">
                {approvedCount > 0
                  ? `${averageSalaryIncrease.toFixed(1)}%`
                  : "0%"}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-brand" />
              <h2 className="font-display text-xl font-semibold text-text">
                Submission Reports
              </h2>
            </div>

            <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-bg p-2">
              <button
                type="button"
                onClick={() => setActiveTab("review")}
                className={
                  activeTab === "review"
                    ? "rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-text shadow-sm"
                    : "rounded-lg px-4 py-2 text-sm font-medium text-text-2"
                }
              >
                Ready for HR Review
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("approved")}
                className={
                  activeTab === "approved"
                    ? "rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-text shadow-sm"
                    : "rounded-lg px-4 py-2 text-sm font-medium text-text-2"
                }
              >
                Fully Approved
              </button>
            </div>

            {activeSubmissions.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg p-6 text-sm text-text-2">
                {activeTab === "review"
                  ? "No submissions are ready for HR review yet."
                  : "No fully approved appraisals are available yet."}
              </div>
            ) : (
              <div className="space-y-3">
                {activeSubmissions.map((submission) => (
                  <article
                    key={submission.id}
                    className="rounded-xl border border-border bg-bg p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-text">
                          {submission.user.firstName} {submission.user.lastName}
                        </p>
                        <p className="text-xs text-text-2">
                          {submission.user.email}
                        </p>
                        <p className="mt-1 text-xs text-text-3">
                          {submission.user.department?.name || "N/A"} |{" "}
                          {submission.cycle.name} | {submission.itemsCount}{" "}
                          criteria
                        </p>
                        <p className="mt-1 text-xs text-text-3">
                          Final score: {submission.finalScore?.toFixed(2) ?? 0}{" "}
                          | Selected points: {submission.totalSelectedPoints}
                        </p>
                        <p className="mt-1 text-xs text-text-3">
                          Salary Increase:{" "}
                          {(
                            submission.superAdminApprovedPercent ??
                            submission.finalPercent ??
                            0
                          ).toFixed(1)}
                          % | Updated salary: ₹
                          {(submission.currentSalary ?? 0).toLocaleString(
                            "en-IN",
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeTab === "review" ? (
                          <>
                            <span className="inline-flex items-center rounded-full bg-success-bg px-3 py-1 text-xs font-semibold text-success">
                              <Clock className="mr-1 h-3 w-3" />
                              {submission.status}
                            </span>
                            <Link
                              href={`/hr-review/${submission.id}/review`}
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition hover:bg-surface-2"
                            >
                              Review
                            </Link>
                          </>
                        ) : (
                          <Link
                            href={`/hr-review/${submission.id}/review`}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition hover:bg-surface-2"
                          >
                            View
                          </Link>
                        )}
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

export default withAuth(HrSubmissionsPage, ["HR", "ADMIN", "SUPER_ADMIN"]);
