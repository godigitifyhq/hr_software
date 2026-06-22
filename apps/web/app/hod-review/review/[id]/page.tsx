"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
  XCircle,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui";
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
  facultyRemarks: string | null;
  facultyPoints: number;
  approvedPoints: number;
  hodRemark: string;
  evidence: {
    url: string;
    fileName?: string;
    mime?: string;
    size?: number;
  } | null;
};

const CRITERION_ORDER = [
  // Base criteria (I–XIII)
  "academics_average_result",
  "research_publications",
  "impact_factor",
  "books_published",
  "patents",
  "conference_seminar_workshop",
  "fdp_stp",
  "research_project_consultancy",
  "research_guidance",
  "co_curricular_activities",
  "attendance",
  "awards_recognition",
  // HOD-only criteria (XIV–XVIII)
  "fee_recovery",
  "awards_outside_svgoi",
  "overall_university_result",
  "placement",
  "department_university_positions",
];

function sortByOrder(items: ReviewItem[]): ReviewItem[] {
  return [...items].sort((a, b) => {
    const ia = CRITERION_ORDER.indexOf(a.criterionKey);
    const ib = CRITERION_ORDER.indexOf(b.criterionKey);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

type RequestDetail = {
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
  additionalPoints: number;
  additionalPointsRemark: string;
  overallRemark: string;
};

type ItemState = {
  approvedPoints: number;
  remark: string;
};

function fullEvidenceUrl(url: string) {
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

function HodReviewDetailPage() {
  const router = useRouter();
  const params = useParams();
  const appraisalId = params?.id as string;
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [additionalPoints, setAdditionalPoints] = useState(0);
  const [additionalPointsRemark, setAdditionalPointsRemark] = useState("");
  const [overallRemark, setOverallRemark] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.hod.getFacultyRequestById(appraisalId);
        if (!active) {
          return;
        }

        const payload = response.data as unknown as RequestDetail;
        setDetail(payload);
        setAdditionalPoints(payload.additionalPoints || 0);
        setAdditionalPointsRemark(payload.additionalPointsRemark || "");
        setOverallRemark(payload.overallRemark || "");

        const nextState: Record<string, ItemState> = {};
        payload.items.forEach((item) => {
          nextState[item.id] = {
            approvedPoints: item.approvedPoints,
            remark: item.hodRemark || "",
          };
        });
        setItemState(nextState);
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load appraisal request detail",
          );
          setDetail(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (appraisalId) {
      void loadDetail();
    }

    return () => {
      active = false;
    };
  }, [appraisalId]);

  const canEdit =
    detail?.status === "SUBMITTED" || detail?.status === "HOD_REVIEW";

  const totalApprovedPoints = useMemo(() => {
    const itemTotal = Object.values(itemState).reduce(
      (sum, item) => sum + Number(item.approvedPoints || 0),
      0,
    );
    return itemTotal + additionalPoints;
  }, [additionalPoints, itemState]);

  function updateItem(id: string, patch: Partial<ItemState>) {
    setItemState((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  async function submitReview() {
    if (!detail) {
      return;
    }

    const itemsPayload = detail.items.map((item) => ({
      itemId: item.id,
      approvedPoints: Number(
        itemState[item.id]?.approvedPoints ?? item.facultyPoints,
      ),
      remark: itemState[item.id]?.remark?.trim() || undefined,
    }));

    const hasDeduction = detail.items.some((item) => {
      const approved = Number(
        itemState[item.id]?.approvedPoints ?? item.facultyPoints,
      );
      return approved < item.facultyPoints;
    });

    if (hasDeduction) {
      const missingRemark = detail.items.some((item) => {
        const approved = Number(
          itemState[item.id]?.approvedPoints ?? item.facultyPoints,
        );
        if (approved < item.facultyPoints) {
          return !(itemState[item.id]?.remark || "").trim();
        }
        return false;
      });

      if (missingRemark) {
        setError("Remarks are required for each deducted criterion.");
        return;
      }
    }

    if (additionalPoints > 0 && !additionalPointsRemark.trim()) {
      setError("Additional points remark is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      await api.hod.submitFacultyReview(appraisalId, {
        items: itemsPayload,
        additionalPoints,
        additionalPointsRemark: additionalPointsRemark.trim() || undefined,
        overallRemark: overallRemark.trim() || undefined,
      });
      setMessage("HOD review submitted and forwarded successfully.");
      setTimeout(() => {
        router.push("/hod-review");
      }, 1000);
    } catch (saveError: any) {
      setError(
        saveError?.response?.data?.message ||
          saveError?.message ||
          "Failed to submit HOD review",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rejectAppraisal() {
    if (!rejectReason.trim()) return;
    try {
      setRejecting(true);
      setError(null);
      await api.hod.rejectAppraisal(appraisalId, rejectReason.trim());
      setRejectDialogOpen(false);
      setMessage("Appraisal rejected.");
      setTimeout(() => router.push("/hod-review"), 1000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to reject");
    } finally {
      setRejecting(false);
    }
  }

  if (loading) {
    return (
      <AppShell role={role}>
        <PageHeader
          title="Review Request"
          subtitle="Loading request detail..."
        />
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading request...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell role={role}>
        <PageHeader title="Review Request" subtitle="Request not found" />
        <div className="rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {error || "Unable to load request detail."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="Faculty Appraisal Review"
        subtitle={`${detail.user.firstName} ${detail.user.lastName} | ${detail.cycle.name}`}
        actions={
          <Link
            href="/hod-review"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      {/* View-only banner */}
      {!canEdit && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-success/20 bg-success-bg p-4 text-sm text-success">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">HOD review submitted</p>
            <p className="mt-0.5 text-text-2">
              This appraisal has been forwarded to the next stage. You can view
              your submitted review below (read-only).
            </p>
          </div>
        </div>
      )}

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

      <div className="space-y-4">
        {sortByOrder(detail.items).map((item) => {
          const approved = Number(
            itemState[item.id]?.approvedPoints ?? item.facultyPoints,
          );
          const isDeducted = approved < item.facultyPoints;

          return (
            <section
              key={item.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
            >
              <h3 className="font-display text-lg font-semibold text-text">
                {item.heading}
              </h3>
              <p className="mt-1 text-sm text-text-2">
                Selected: {item.selectedLabel || item.selectedValue}
              </p>
              <p className="mt-1 text-sm text-text-2">
                Faculty points: {item.facultyPoints}
              </p>
              {item.facultyRemarks ? (
                <div className="mt-2 rounded-lg border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
                    Faculty Remarks / Author Position
                  </p>
                  <p className="mt-0.5 text-sm text-text-2">
                    {item.facultyRemarks}
                  </p>
                </div>
              ) : null}

              {canEdit ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-text">
                      Approved points
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={item.facultyPoints}
                      value={approved}
                      title={`Approved points for ${item.heading}`}
                      onChange={(event) =>
                        updateItem(item.id, {
                          approvedPoints: Math.max(
                            0,
                            Math.min(
                              item.facultyPoints,
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
                      HOD Remarks {isDeducted ? "(Required)" : "(Optional)"}
                    </label>
                    <textarea
                      value={itemState[item.id]?.remark || ""}
                      rows={2}
                      onChange={(event) =>
                        updateItem(item.id, { remark: event.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                      placeholder={
                        isDeducted
                          ? "Reason for deduction (required)"
                          : "Optional remark for this criterion"
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 rounded-lg bg-bg p-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                      HOD Approved Points
                    </p>
                    <p className="mt-1 text-sm font-medium text-text">
                      {approved}
                      {isDeducted && (
                        <span className="ml-2 text-xs text-warning">
                          (deducted from {item.facultyPoints})
                        </span>
                      )}
                    </p>
                  </div>
                  {(itemState[item.id]?.remark || item.hodRemark) && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                        Remark
                      </p>
                      <p className="mt-1 text-sm text-text-2">
                        {itemState[item.id]?.remark || item.hodRemark}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {Array.isArray(item.evidence) && item.evidence.length > 0 ? (
                <div className="mt-4 space-y-1">
                  {(item.evidence as unknown as any[]).map((e: any, idx: number) => (
                    <a
                      key={idx}
                      href={fullEvidenceUrl(e.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-dark"
                    >
                      View uploaded evidence
                      {(item.evidence as unknown as any[]).length > 1 ? ` (${idx + 1})` : ""}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-text">
          Final HOD Inputs
        </h3>
        {canEdit ? (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">
                  HOD&apos;s Remarks Score (1 to 4 Marks)
                </label>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={additionalPoints}
                  title="HOD's Remarks Score (1 to 4 Marks)"
                  onChange={(event) =>
                    setAdditionalPoints(
                      Math.max(0, Math.min(4, Number(event.target.value || 0))),
                    )
                  }
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">
                  Remarks for HOD&apos;s Score{" "}
                  {additionalPoints > 0 ? "(Required)" : "(Optional)"}
                </label>
                <input
                  value={additionalPointsRemark}
                  onChange={(event) =>
                    setAdditionalPointsRemark(event.target.value)
                  }
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
                  placeholder="Type Your Remarks here"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-text">
                  Overall remark (Optional)
                </label>
                <textarea
                  value={overallRemark}
                  onChange={(event) => setOverallRemark(event.target.value)}
                  className="min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                  placeholder="Final review note"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-text-2">
                Total approved points (including additional):{" "}
                {totalApprovedPoints}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={saving || rejecting}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-danger/30 bg-danger-bg px-4 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => void submitReview()}
                  disabled={saving || rejecting}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Submitting..." : "Submit HOD Review"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4 grid gap-3 rounded-lg bg-bg p-3 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Additional Points
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {additionalPoints}
              </p>
            </div>
            {additionalPointsRemark && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Additional Points Remark
                </p>
                <p className="mt-1 text-sm text-text-2">
                  {additionalPointsRemark}
                </p>
              </div>
            )}
            {overallRemark && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Overall Remark
                </p>
                <p className="mt-1 text-sm text-text-2">{overallRemark}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Total Approved Points
              </p>
              <p className="mt-1 text-sm font-bold text-text">
                {totalApprovedPoints}
              </p>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={rejectDialogOpen}
        title="Reject Appraisal"
        description={
          <div className="space-y-3">
            <p className="text-sm text-text-2">This will reject the appraisal. Please provide a reason.</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)..."
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        }
        confirmLabel={rejecting ? "Rejecting..." : "Confirm Reject"}
        onCancel={() => { setRejectDialogOpen(false); setRejectReason(""); }}
        onConfirm={() => void rejectAppraisal()}
      />
    </AppShell>
  );
}

export default withAuth(HodReviewDetailPage, ["HOD"]);
