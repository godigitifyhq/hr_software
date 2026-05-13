"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, Save } from "lucide-react";
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
  approvedPoints: number;
  hodRemark: string;
  evidence: {
    url: string;
    fileName?: string;
    mime?: string;
    size?: number;
  } | null;
};

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
      approvedPoints: Number(itemState[item.id]?.approvedPoints ?? item.facultyPoints),
      remark: itemState[item.id]?.remark?.trim() || undefined,
    }));

    const hasDeduction = detail.items.some((item) => {
      const approved = Number(itemState[item.id]?.approvedPoints ?? item.facultyPoints);
      return approved < item.facultyPoints;
    });

    if (hasDeduction) {
      const missingRemark = detail.items.some((item) => {
        const approved = Number(itemState[item.id]?.approvedPoints ?? item.facultyPoints);
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

  if (loading) {
    return (
      <AppShell role={role}>
        <PageHeader title="Review Request" subtitle="Loading request detail..." />
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
        {detail.items.map((item) => {
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
                    Item remark {isDeducted ? "(Required)" : "(Optional)"}
                  </label>
                  <input
                    value={itemState[item.id]?.remark || ""}
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
          Final HOD Inputs
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Additional points (0 to 4)
            </label>
            <input
              type="number"
              min={0}
              max={4}
              value={additionalPoints}
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
              Additional points remark {additionalPoints > 0 ? "(Required)" : "(Optional)"}
            </label>
            <input
              value={additionalPointsRemark}
              onChange={(event) => setAdditionalPointsRemark(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              placeholder="Reason for granting additional points"
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
            Total approved points (including additional): {totalApprovedPoints}
          </p>
          <button
            type="button"
            onClick={() => void submitReview()}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Submitting..." : "Submit HOD Review"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}

export default withAuth(HodReviewDetailPage, ["HOD"]);
