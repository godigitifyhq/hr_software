"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { withAuth } from "@/components/auth/withAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, type AppraisalSummary } from "@/lib/api";
import { formatDate } from "@/lib/utils/dates";
import { calcCompletedCount } from "@/lib/utils/scores";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

type AppraisalCard = AppraisalSummary & {
  itemCount?: number;
  completedItems?: number;
};

function AppraisalsPage() {
  const { session } = useAuthStore();
  const [appraisals, setAppraisals] = useState<AppraisalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCycleInfo, setActiveCycleInfo] = useState<{
    hasRequest: boolean;
    status?: string;
    cycle?: { name: string; endDate?: string };
  } | null>(null);

  const role = getPrimaryRole(session?.user.roles ?? []);

  async function loadAppraisals() {
    try {
      setLoading(true);
      setError(null);

      // Load faculty appraisal status to get active cycle info
      try {
        const statusResponse = await api.faculty.getAppraisalStatus();
        setActiveCycleInfo(statusResponse.data);
      } catch {
        // If status endpoint fails, continue anyway
        setActiveCycleInfo(null);
      }

      const listResponse = await api.appraisals.list();
      const base = listResponse.data ?? [];

      const detailed = await Promise.allSettled(
        base.map(async (item) => {
          const detail = await api.appraisals.getById(item.id);
          const items = detail.data.items ?? [];

          return {
            ...item,
            itemCount: items.length,
            completedItems: calcCompletedCount(
              items.map((entry) => ({
                selfScore: entry.points ?? entry.selfScore,
              })),
            ),
          } satisfies AppraisalCard;
        }),
      );

      const detailedFiltered = detailed.filter(
        (result) => result.status === "fulfilled",
      ) as PromiseFulfilledResult<AppraisalCard>[];

      setAppraisals(
        detailedFiltered
          .map((result) => result.value)
          .filter((item) => item.itemCount !== undefined)
          .concat(
            base
              .filter(
                (item) =>
                  !detailed.some(
                    (result) =>
                      result.status === "fulfilled" &&
                      result.value.id === item.id,
                  ),
              )
              .map((item) => item as AppraisalCard),
          ),
      );
    } catch (fetchError: any) {
      setError(
        fetchError?.response?.data?.message ||
          fetchError?.message ||
          "Failed to load appraisals",
      );
      setAppraisals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAppraisals();
  }, []);

  const activeCycle = useMemo(
    () =>
      appraisals.find((item) => item.cycle?.isActive) ??
      appraisals.find((item) => item.status === "DRAFT"),
    [appraisals],
  );
  const editableDraft = useMemo(
    () => appraisals.find((item) => item.status === "DRAFT" && !item.locked),
    [appraisals],
  );

  // Check if user has submitted for the current cycle (from actual appraisals list)
  const hasSubmittedForCurrentCycle = useMemo(() => {
    return appraisals.some((item) => item.status !== "DRAFT");
  }, [appraisals]);

  return (
    <AppShell role={role}>
      <PageHeader
        title="My Appraisals"
        subtitle="Track and manage your performance reviews"
        actions={
          <button
            type="button"
            onClick={() => void loadAppraisals()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {activeCycle ? (
        <div className="mb-6 rounded-2xl border-l-4 border-brand bg-brand-light p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-brand">
                {activeCycle.cycle?.name ?? "Current cycle"} is open · Deadline:{" "}
                {activeCycle.cycle?.endDate
                  ? formatDate(activeCycle.cycle.endDate)
                  : "—"}
              </p>
              <p className="mt-1 text-sm text-text-2">
                Continue your self-appraisal while the cycle is active.
              </p>
            </div>
            <Link
              href={
                editableDraft
                  ? `/appraisals/${editableDraft.id}/edit`
                  : "/appraisals"
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
            >
              Continue Self-Appraisal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : activeCycleInfo && !activeCycleInfo.hasRequest ? (
        <div className="mb-6 rounded-2xl border-l-4 border-brand bg-brand-light p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-brand">
                Active Appraisal Cycle Open
              </p>
              <p className="mt-1 text-sm text-text-2">
                Submit your appraisal to get started with the current cycle.
              </p>
            </div>
            <Link
              href="/faculty-dashboard/request-appraisal"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
            >
              Submit Appraisal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : !hasSubmittedForCurrentCycle && activeCycleInfo ? (
        <div className="mb-6 rounded-2xl border-l-4 border-brand bg-brand-light p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-brand">
                Active Appraisal Cycle Open
              </p>
              <p className="mt-1 text-sm text-text-2">
                Submit your appraisal to get started with the current cycle.
              </p>
            </div>
            <Link
              href="/faculty-dashboard/request-appraisal"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
            >
              Submit Appraisal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : hasSubmittedForCurrentCycle ? (
        <div className="mb-6 rounded-2xl border-l-4 border-success bg-success-bg p-4 shadow-sm">
          <div>
            <p className="text-sm font-medium text-success">
              ✓ Appraisal submitted for current cycle
            </p>
            <p className="mt-1 text-sm text-text-2">
              Thank you for submitting. Please wait for the next cycle to open.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-text">
            No active cycle right now.
          </p>
          <p className="mt-1 text-sm text-text-2">
            Your HR team will open a new appraisal cycle when it is ready.
          </p>
        </div>
      )}

      {error ? (
        <div className="mb-6 rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-2xl border border-border bg-surface shadow-sm animate-pulse"
            />
          ))}
        </div>
      ) : appraisals.length === 0 ? (
        <EmptyState
          title="No appraisals yet"
          description="No appraisals have been created for your account yet. Your HR team will open a cycle soon."
        />
      ) : (
        <div className="space-y-4">
          {appraisals.map((appraisal) => {
            const canEdit = appraisal.status === "DRAFT" && !appraisal.locked;

            return (
              <article
                key={appraisal.id}
                className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-border-strong hover:shadow-md"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-display text-lg font-semibold text-text">
                        {appraisal.cycle?.name ?? "Appraisal cycle"}
                      </h2>
                      <StatusBadge status={appraisal.status} />
                    </div>
                    <p className="mt-2 text-sm text-text-2">
                      {appraisal.submittedAt
                        ? `Submitted: ${formatDate(appraisal.submittedAt)}`
                        : `Last saved: ${formatDate(
                            appraisal.updatedAt ??
                              appraisal.createdAt ??
                              new Date().toISOString(),
                          )}`}
                    </p>
                    {typeof appraisal.itemCount === "number" ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-sm text-text-2">
                          <span>
                            {appraisal.completedItems ?? 0} of{" "}
                            {appraisal.itemCount} items completed
                          </span>
                          <span>
                            {appraisal.itemCount > 0
                              ? `${Math.round(
                                  ((appraisal.completedItems ?? 0) /
                                    appraisal.itemCount) *
                                    100,
                                )}%`
                              : "0%"}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-2">
                          <div
                            className="h-2 rounded-full bg-brand transition-all"
                            style={{
                              width: `${
                                appraisal.itemCount > 0
                                  ? ((appraisal.completedItems ?? 0) /
                                      appraisal.itemCount) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/appraisals/${appraisal.id}`}
                      className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-text-2 transition hover:bg-surface-2 hover:text-text"
                    >
                      View Details
                    </Link>
                    {canEdit ? (
                      <Link
                        href={`/appraisals/${appraisal.id}/edit`}
                        className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-brand transition hover:bg-brand-light"
                      >
                        Edit
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

export default withAuth(AppraisalsPage, ["EMPLOYEE", "FACULTY"]);
