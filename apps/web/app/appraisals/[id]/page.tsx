"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { withAuth } from "@/components/auth/withAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AppraisalItemRow } from "@/components/ui/AppraisalItemRow";
import { api, type AppraisalSummary } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { calcWeightedScore } from "@/lib/utils/scores";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function AppraisalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const appraisalId = params?.id as string;
  const { session } = useAuthStore();
  const [appraisal, setAppraisal] = useState<AppraisalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role = getPrimaryRole(session?.user.roles ?? []);

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
      } catch (fetchError: any) {
        if (active) {
          setError(
            fetchError?.response?.data?.message ||
              fetchError?.message ||
              "Failed to load appraisal",
          );
          setAppraisal(null);
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

  const items = appraisal?.items ?? [];
  const weightedScore = useMemo(
    () =>
      calcWeightedScore(
        items.map((item) => ({
          ...item,
          selfScore: item.points ?? item.selfScore,
        })),
      ),
    [items],
  );
  const canEdit = appraisal?.status === "DRAFT" && !appraisal.locked;

  if (loading) {
    return (
      <AppShell role={role}>
        <PageHeader title="Appraisal details" subtitle="Loading appraisal..." />
        <div className="space-y-4">
          <div className="h-28 rounded-2xl border border-border bg-surface animate-pulse" />
          <div className="h-40 rounded-2xl border border-border bg-surface animate-pulse" />
        </div>
      </AppShell>
    );
  }

  if (error || !appraisal) {
    return (
      <AppShell role={role}>
        <EmptyState
          title="Appraisal not found"
          description={error || "The requested appraisal could not be loaded."}
          action={
            <button
              type="button"
              onClick={() => router.push("/appraisals")}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
            >
              Back to appraisals
            </button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title={appraisal.cycle?.name ?? "Appraisal details"}
        subtitle={
          appraisal.submittedAt
            ? `Submitted ${formatDateTime(appraisal.submittedAt)}`
            : `Last saved ${formatDateTime(
                appraisal.updatedAt ??
                  appraisal.createdAt ??
                  new Date().toISOString(),
              )}`
        }
        actions={
          <>
            {canEdit ? (
              <Link
                href={`/appraisals/${appraisal.id}/edit`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </>
        }
      />

      <section className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-semibold text-text">
                Overall Score {weightedScore.toFixed(2)}
              </h2>
              <StatusBadge status={appraisal.status} />
            </div>
            <p className="mt-2 text-sm text-text-2">
              Cycle: {appraisal.cycle?.name ?? "—"} · Submitted:{" "}
              {appraisal.submittedAt ? formatDate(appraisal.submittedAt) : "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-brand-light px-4 py-3 text-sm text-brand">
            Employee:{" "}
            {appraisal.user
              ? `${appraisal.user.firstName} ${appraisal.user.lastName}`
              : "—"}
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyState
          title="No appraisal items"
          description="This appraisal does not contain any scored items yet."
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-2">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">
                    Item Label
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">
                    Weight
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">
                    Self Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">
                    HOD Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">
                    Committee Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">
                    Weighted Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-2">
                {items.map((item) => {
                  const scores = [
                    item.points ?? item.selfScore,
                    item.hodScore,
                    item.committeeScore,
                  ].filter(
                    (value): value is number => typeof value === "number",
                  );
                  const current =
                    scores.length > 0
                      ? scores.reduce((sum, value) => sum + value, 0) /
                        scores.length
                      : 0;
                  const weighted = Number((current * item.weight).toFixed(2));

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm font-medium text-text">
                        {item.label ?? item.key ?? "Item"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-2">
                        {(item.weight * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-text-2">
                        {item.points ?? item.selfScore ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-2">
                        {item.hodScore ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-2">
                        {item.committeeScore ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-2">
                        {weighted.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            {items.map((item) => (
              <AppraisalItemRow
                key={item.id}
                item={{ ...item, selfScore: item.points ?? item.selfScore }}
                mode="view"
              />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default withAuth(AppraisalDetailPage, ["EMPLOYEE"]);
