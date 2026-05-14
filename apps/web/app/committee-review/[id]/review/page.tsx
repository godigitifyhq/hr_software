"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Save,
  AlertCircle,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

type ReviewItem = {
  id: string;
  criterionKey: string;
  heading: string;
  selectedValue: string;
  selectedLabel: string;
  facultyPoints: number;
  hodApprovedPoints: number;
  hodRemark: string;
  evidence: {
    url: string;
    fileName?: string;
    mime?: string;
    size?: number;
  } | null;
};

type CommitteeAppraisalDetail = {
  id: string;
  status: string;
  submittedAt?: string | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  cycle: {
    name: string;
  };
  items: ReviewItem[];
  finalScore?: number | null;
  committeeNotes?: string | null;
};

type ItemState = {
  approvedPoints: number;
  remark: string;
};

function fullEvidenceUrl(url: string) {
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

function parseItemNotes(notes: string | null | undefined) {
  if (!notes) {
    return {};
  }

  try {
    return JSON.parse(notes) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function CommitteeReviewPage() {
  const params = useParams();
  const router = useRouter();
  const appraisalId = params.id as string;
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  const [appraisal, setAppraisal] = useState<CommitteeAppraisalDetail | null>(
    null,
  );
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAppraisal() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.appraisals.getById(appraisalId);
        const payload = response.data as unknown as CommitteeAppraisalDetail & {
          items: Array<{
            id: string;
            key: string;
            points: number;
            notes?: string | null;
          }>;
        };

        const nextItems = payload.items.map((item) => {
          const parsed = parseItemNotes(item.notes);
          const hodReview =
            typeof parsed.hodReview === "object" && parsed.hodReview
              ? (parsed.hodReview as Record<string, unknown>)
              : null;

          return {
            id: item.id,
            criterionKey: item.key,
            heading:
              typeof parsed.heading === "string" ? parsed.heading : item.key,
            selectedValue:
              typeof parsed.selectedValue === "string"
                ? parsed.selectedValue
                : "",
            selectedLabel:
              typeof parsed.selectedLabel === "string"
                ? parsed.selectedLabel
                : "",
            facultyPoints:
              typeof hodReview?.originalPoints === "number"
                ? Number(hodReview.originalPoints)
                : item.points,
            hodApprovedPoints:
              typeof hodReview?.approvedPoints === "number"
                ? Number(hodReview.approvedPoints)
                : item.points,
            hodRemark:
              typeof hodReview?.remark === "string"
                ? String(hodReview.remark)
                : "",
            evidence:
              typeof parsed.evidence === "object" && parsed.evidence
                ? (parsed.evidence as ReviewItem["evidence"])
                : null,
          };
        });

        if (!active) {
          return;
        }

        setAppraisal({
          id: payload.id,
          status: payload.status,
          submittedAt: payload.submittedAt,
          user: payload.user,
          cycle: payload.cycle,
          items: nextItems,
          finalScore: payload.finalScore,
          committeeNotes: payload.committeeNotes,
        });

        const initialState: Record<string, ItemState> = {};
        nextItems.forEach((item) => {
          initialState[item.id] = {
            approvedPoints: item.hodApprovedPoints,
            remark: "",
          };
        });
        setItemState(initialState);
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load appraisal review",
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

  const totalApprovedPoints = useMemo(
    () =>
      Object.values(itemState).reduce(
        (sum, item) => sum + Number(item.approvedPoints || 0),
        0,
      ),
    [itemState],
  );

  function updateItem(id: string, patch: Partial<ItemState>) {
    setItemState((current) => ({
      ...current,
      [id]: {
        approvedPoints: current[id]?.approvedPoints ?? 0,
        remark: current[id]?.remark ?? "",
        ...patch,
      },
    }));
  }

  async function submitReview() {
    if (!appraisal) {
      return;
    }

    const itemsPayload = appraisal.items.map((item) => ({
      itemId: item.id,
      approvedPoints: Number(
        itemState[item.id]?.approvedPoints ?? item.hodApprovedPoints,
      ),
      remark: itemState[item.id]?.remark?.trim() || undefined,
    }));

    const hasDeduction = appraisal.items.some((item) => {
      const approved = Number(
        itemState[item.id]?.approvedPoints ?? item.hodApprovedPoints,
      );
      return approved < item.hodApprovedPoints;
    });

    if (hasDeduction) {
      const missingRemark = appraisal.items.some((item) => {
        const approved = Number(
          itemState[item.id]?.approvedPoints ?? item.hodApprovedPoints,
        );
        if (approved < item.hodApprovedPoints) {
          return !(itemState[item.id]?.remark || "").trim();
        }
        return false;
      });

      if (missingRemark) {
        setError("Remarks are required for each deducted criterion.");
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      await api.committee.submitReview(appraisalId, {
        items: itemsPayload,
      });
      setMessage("Committee review submitted successfully.");
      setTimeout(() => {
        router.push("/committee-review");
      }, 1000);
    } catch (submitError: any) {
      setError(
        submitError?.response?.data?.message ||
          submitError?.message ||
          "Failed to submit committee review",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell role={role}>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading appraisal review...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !appraisal) {
    return (
      <AppShell role={role}>
        <PageHeader
          title="Committee Appraisal Review"
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
        title="Committee Appraisal Review"
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

      {error ? (
        <div className="mb-5 rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mb-5 rounded-2xl border border-success/20 bg-success-bg p-4 text-sm text-success">
          {message}
        </div>
      ) : null}

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
            Total Approved Points
          </p>
          <p className="mt-2 font-semibold text-text">{totalApprovedPoints}</p>
        </div>
      </div>

      <div className="space-y-4">
        {appraisal.items.map((item) => {
          const approved = Number(
            itemState[item.id]?.approvedPoints ?? item.hodApprovedPoints,
          );
          const isDeducted = approved < item.hodApprovedPoints;

          return (
            <section
              key={item.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
            >
              <h3 className="font-display text-lg font-semibold text-text">
                {item.heading}
              </h3>
              <p className="mt-1 text-sm text-text-2">
                Selected by faculty: {item.selectedLabel || item.selectedValue}
              </p>
              <p className="mt-1 text-sm text-text-2">
                Remark by HOD: {item.hodRemark || "-"}
              </p>
              <p className="mt-1 text-sm text-text-2">
                Final point by HOD: {item.hodApprovedPoints}
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Committee approved points
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={item.hodApprovedPoints}
                    value={approved}
                    aria-label={`Committee approved points for ${item.heading}`}
                    title={`Committee approved points for ${item.heading}`}
                    onChange={(event) =>
                      updateItem(item.id, {
                        approvedPoints: Math.max(
                          0,
                          Math.min(
                            item.hodApprovedPoints,
                            Number(event.target.value || 0),
                          ),
                        ),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Committee remark {isDeducted ? "(Required)" : "(Optional)"}
                  </label>
                  <input
                    value={itemState[item.id]?.remark || ""}
                    aria-label={`Committee remark for ${item.heading}`}
                    title={`Committee remark for ${item.heading}`}
                    onChange={(event) =>
                      updateItem(item.id, { remark: event.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
                    placeholder={
                      isDeducted
                        ? "Reason for deduction"
                        : "Optional remark for this criterion"
                    }
                  />
                </div>
              </div>

              {item.evidence?.url ? (
                <div className="mt-4">
                  <a
                    href={fullEvidenceUrl(item.evidence.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-dark"
                  >
                    View uploaded evidence
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-text">
          Final Committee Inputs
        </h3>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-2">
            Total approved points: {totalApprovedPoints}
          </p>
          <button
            type="button"
            onClick={() => void submitReview()}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}

export default withAuth(CommitteeReviewPage, ["COMMITTEE"]);
