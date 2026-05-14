"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Filter,
  Eye,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

interface AppraisalForReview {
  id: string;
  status: string;
  cycle: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    department?: {
      id: string;
      name: string;
    } | null;
  };
  submittedAt: string;
  finalScore: number | null;
  totalSelectedPoints: number;
  itemsCount: number;
}

function CommitteeDashboardPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  const [appraisals, setAppraisals] = useState<AppraisalForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<
    "All" | "Academics" | "Research" | "Others"
  >("All");

  useEffect(() => {
    let active = true;

    async function loadAppraisals() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.committee.getTeamAppraisals();

        if (active) {
          setAppraisals(
            response.data.map((appraisal) => ({
              ...appraisal,
              totalSelectedPoints: appraisal.items?.reduce(
                (sum, item) => sum + (item.points ?? 0),
                0,
              ),
              itemsCount: appraisal.items?.length ?? 0,
            })) as AppraisalForReview[],
          );
        }
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load appraisals for review",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAppraisals();

    return () => {
      active = false;
    };
  }, []);

  const getStatusBadge = (status: string) => {
    const badges: Record<
      string,
      { bg: string; text: string; icon: React.ReactNode }
    > = {
      COMMITTEE_REVIEW: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      },
      HR_FINALIZED: {
        bg: "bg-green-100",
        text: "text-green-800",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      },
    };

    const badge = badges[status] || badges.COMMITTEE_REVIEW;
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full ${badge.bg} ${badge.text} px-3 py-1 text-xs font-semibold uppercase tracking-wider`}
      >
        {badge.icon}
        {status.replace(/_/g, " ")}
      </div>
    );
  };

  if (loading) {
    return (
      <AppShell role={role}>
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-6">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
          <span className="text-sm text-text-2">Loading appraisals...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="Committee Review Dashboard"
        subtitle="Review and approve faculty appraisals submitted by HOD"
      />

      {error && (
        <div className="mb-6 rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        </div>
      )}

      {appraisals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg">
            <CheckCircle2 className="h-6 w-6 text-text-3" />
          </div>
          <h3 className="mb-2 font-display text-lg font-semibold text-text">
            No appraisals to review
          </h3>
          <p className="text-sm text-text-2">
            There are no appraisals pending committee review at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filter Section */}
          {/* <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Filter className="h-4 w-4 text-text-2" />
              <p className="text-sm font-semibold text-text">
                Filter by Category
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["All", "Academics", "Research", "Others"] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      filterCategory === cat
                        ? "bg-brand text-white"
                        : "border border-border bg-bg text-text hover:bg-surface"
                    }`}
                  >
                    {cat}
                  </button>
                ),
              )}
            </div>
          </div> */}

          {/* Appraisals Grid */}
          <div className="grid gap-4">
            {appraisals.map((appraisal) => (
              <div
                key={appraisal.id}
                className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div>
                        <h4 className="font-semibold text-text">
                          {appraisal.user.firstName} {appraisal.user.lastName}
                        </h4>
                        <p className="text-xs text-text-3 mt-0.5">
                          {appraisal.user.email}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg bg-bg p-3">
                        <p className="text-xs font-semibold text-text-3 uppercase tracking-wider">
                          Department
                        </p>
                        <p className="mt-1 text-sm font-medium text-text">
                          {appraisal.user.department?.name ?? "Not assigned"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-bg p-3">
                        <p className="text-xs font-semibold text-text-3 uppercase tracking-wider">
                          Cycle
                        </p>
                        <p className="mt-1 text-sm font-medium text-text">
                          {appraisal.cycle.name}
                        </p>
                      </div>

                      <div className="rounded-lg bg-bg p-3">
                        <p className="text-xs font-semibold text-text-3 uppercase tracking-wider">
                          Total Points
                        </p>
                        <p className="mt-1 text-sm font-medium text-text">
                          {appraisal.totalSelectedPoints}
                        </p>
                      </div>

                      <div className="rounded-lg bg-bg p-3">
                        <p className="text-xs font-semibold text-text-3 uppercase tracking-wider">
                          Status
                        </p>
                        <div className="mt-1">
                          {getStatusBadge(appraisal.status)}
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-text-3">
                      Submitted:{" "}
                      {new Date(appraisal.submittedAt).toLocaleDateString()}
                    </p>
                  </div>

                  {appraisal.status === "COMMITTEE_REVIEW" && (
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/committee-review/${appraisal.id}/review`}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark whitespace-nowrap"
                      >
                        <Eye className="h-4 w-4" />
                        Review
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default withAuth(CommitteeDashboardPage, ["COMMITTEE"]);
