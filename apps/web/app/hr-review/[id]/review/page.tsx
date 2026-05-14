"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  AppraisalReviewLayer,
  type AppraisalReviewLayerProps,
} from "@/components/ui/AppraisalReviewSection";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function fullEvidenceUrl(url: string) {
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

type ItemState = Record<string, { approvedPoints: number; remark?: string }>;

function HRReviewDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  useEffect(() => {
    if (!session) {
      router.push("/login");
    }
  }, [session, router]);

  const [appraisal, setAppraisal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [itemState, setItemState] = useState<ItemState>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const response = await api.hr.getById(id);
        if (!active) return;
        setAppraisal(response.data);

        const initial: Record<string, any> = {};
        (response.data.items || []).forEach((it: any) => {
          initial[it.id] = {
            approvedPoints:
              it.committeeApprovedPoints ??
              it.hodApprovedPoints ??
              it.facultyPoints,
            remark: it.committeeRemark ?? "",
          };
        });
        setItemState(initial);
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
    return () => {
      active = false;
    };
  }, [id]);

  const totalFacultyPoints = useMemo(
    () =>
      (appraisal?.items || []).reduce(
        (s: number, it: any) => s + it.facultyPoints,
        0,
      ),
    [appraisal],
  );

  const totalHodApproved = useMemo(
    () =>
      (appraisal?.items || []).reduce(
        (s: number, it: any) => s + (it.hodApprovedPoints ?? it.facultyPoints),
        0,
      ),
    [appraisal],
  );

  const totalCommitteeApproved = useMemo(
    () =>
      (appraisal?.items || []).reduce(
        (s: number, it: any) =>
          s +
          (it.committeeApprovedPoints ??
            it.hodApprovedPoints ??
            it.facultyPoints),
        0,
      ),
    [appraisal],
  );

  const totalApproved = useMemo(
    () =>
      Object.values(itemState).reduce(
        (s: number, it: any) => s + Number(it.approvedPoints || 0),
        0,
      ),
    [itemState],
  );

  const canEdit = appraisal?.status === "HR_FINALIZED";

  function updateItem(
    id: string,
    patch: Partial<{ approvedPoints: number; remark?: string }>,
  ) {
    setItemState((curr) => ({
      ...curr,
      [id]: { ...(curr[id] || {}), ...patch },
    }));
  }

  async function submit() {
    if (!appraisal) return;

    const items = appraisal.items.map((it: any) => ({
      itemId: it.id,
      approvedPoints: Number(itemState[it.id]?.approvedPoints || 0),
      remark: (itemState[it.id]?.remark || "").trim() || undefined,
    }));

    const hasDeduction = appraisal.items.some((it: any) => {
      const upper =
        it.committeeApprovedPoints ?? it.hodApprovedPoints ?? it.facultyPoints;
      return Number(itemState[it.id]?.approvedPoints || 0) < upper;
    });

    if (hasDeduction) {
      const missing = appraisal.items.some((it: any) => {
        const upper =
          it.committeeApprovedPoints ??
          it.hodApprovedPoints ??
          it.facultyPoints;
        if (Number(itemState[it.id]?.approvedPoints || 0) < upper) {
          return !(itemState[it.id]?.remark || "").trim();
        }
        return false;
      });
      if (missing) {
        setError("Please provide remarks for all deductions");
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      await api.hr.submitReview(id, { items });
      setMessage("HR review submitted successfully");
      setTimeout(() => router.push("/hr-review"), 1000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading appraisal...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!appraisal) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <PageHeader
          title="HR Appraisal"
          subtitle="Not found"
          actions={
            <Link
              href="/hr-review"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm"
            >
              Back
            </Link>
          }
        />
        <div className="p-4">Not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader
        title="HR Appraisal Review"
        subtitle={`${appraisal.user?.firstName} ${appraisal.user?.lastName}`}
        actions={
          <Link
            href="/hr-review"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm"
          >
            Back
          </Link>
        }
      />

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Status
          </p>
          <p className="mt-2 text-sm font-semibold text-text">
            {appraisal.status === "HR_FINALIZED"
              ? "HR Review"
              : appraisal.status}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Faculty Claimed
          </p>
          <p className="mt-2 text-2xl font-bold text-text">
            {totalFacultyPoints}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Committee Approved
          </p>
          <p className="mt-2 text-2xl font-bold text-text">
            {totalCommitteeApproved}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            HR Final
          </p>
          <p className="mt-2 text-2xl font-bold text-brand">{totalApproved}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Sidebar - Employee Info */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h4 className="text-sm font-semibold text-text">Employee</h4>
            <div className="mt-3 space-y-2 text-sm">
              <div>
                <p className="font-medium text-text">
                  {appraisal.user?.firstName} {appraisal.user?.lastName}
                </p>
                <p className="text-xs text-text-2">{appraisal.user?.email}</p>
              </div>
              {appraisal.user?.department && (
                <div>
                  <p className="text-xs text-text-3">Department</p>
                  <p className="text-xs font-medium text-text">
                    {appraisal.user.department.name}
                  </p>
                </div>
              )}
            </div>
          </section>

          {appraisal.user?.facultyProfile ? (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h4 className="text-sm font-semibold text-text">Profile</h4>
              <div className="mt-3 space-y-2 text-xs">
                {appraisal.user.facultyProfile.dob && (
                  <div>
                    <p className="text-text-3">DOB</p>
                    <p className="font-medium text-text">
                      {String(appraisal.user.facultyProfile.dob).slice(0, 10)}
                    </p>
                  </div>
                )}
                {appraisal.user.facultyProfile.dateOfJoining && (
                  <div>
                    <p className="text-text-3">Joined</p>
                    <p className="font-medium text-text">
                      {String(
                        appraisal.user.facultyProfile.dateOfJoining,
                      ).slice(0, 10)}
                    </p>
                  </div>
                )}
                {typeof appraisal.user.facultyProfile.totalExperience ===
                  "number" && (
                  <div>
                    <p className="text-text-3">Experience</p>
                    <p className="font-medium text-text">
                      {appraisal.user.facultyProfile.totalExperience} years
                    </p>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {(appraisal.user?.documents ?? []).length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h4 className="text-sm font-semibold text-text">Documents</h4>
              <div className="mt-3 flex flex-col gap-2">
                {appraisal.user.documents.map((doc: any) => (
                  <a
                    key={doc.id}
                    href={doc.directUrl ?? doc.viewUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs text-brand hover:underline"
                    title={doc.name}
                  >
                    {doc.name}
                  </a>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* Main Content - Review Layers */}
        <div className="space-y-6">
          {/* Faculty Selection */}
          <AppraisalReviewLayer
            title="Faculty Claimed"
            description="Points selected by faculty member in their appraisal submission"
            items={appraisal.items.map((it: any) => ({
              itemId: it.id,
              heading: it.heading ?? it.key,
              approvedPoints: it.facultyPoints,
              evidence:
                it.evidence && it.evidence.length > 0
                  ? it.evidence.map((e: any) => ({
                      url: fullEvidenceUrl(e.url),
                      fileName: e.fileName,
                    }))
                  : undefined,
            }))}
          />

          {/* HOD Review */}
          <AppraisalReviewLayer
            title="HOD Evaluation"
            description="Points approved by Head of Department with remarks"
            items={appraisal.items.map((it: any) => ({
              itemId: it.id,
              heading: it.heading ?? it.key,
              approvedPoints: it.hodApprovedPoints ?? it.facultyPoints,
              previousPoints: it.facultyPoints,
              remark: it.hodRemark,
              reviewer: "HOD",
            }))}
          />

          {/* Committee Review */}
          {appraisal.items.some((it: any) => it.committeeApprovedPoints) && (
            <AppraisalReviewLayer
              title="Committee Evaluation"
              description="Points approved by committee members with remarks"
              items={appraisal.items.map((it: any) => ({
                itemId: it.id,
                heading: it.heading ?? it.key,
                approvedPoints:
                  it.committeeApprovedPoints ??
                  it.hodApprovedPoints ??
                  it.facultyPoints,
                previousPoints: it.hodApprovedPoints ?? it.facultyPoints,
                remark: it.committeeRemark,
                reviewer: "Committee",
              }))}
            />
          )}

          {/* HR Review - Current Review */}
          <AppraisalReviewLayer
            title={canEdit ? "HR Final Review" : "HR Final Review"}
            description={
              canEdit
                ? "Review and finalize points for this appraisal cycle"
                : "View-only record after super admin approval"
            }
            isCurrentReview={canEdit}
            items={appraisal.items.map((it: any) => ({
              itemId: it.id,
              heading: it.heading ?? it.key,
              approvedPoints: canEdit
                ? itemState[it.id]?.approvedPoints ?? 0
                : it.committeeApprovedPoints ??
                  it.hodApprovedPoints ??
                  it.facultyPoints,
              previousPoints:
                it.committeeApprovedPoints ??
                it.hodApprovedPoints ??
                it.facultyPoints,
              remark: canEdit
                ? itemState[it.id]?.remark || ""
                : it.committeeRemark || "",
              reviewer: "HR",
            }))}
            itemInputs={
              canEdit
                ? appraisal.items.reduce((acc: any, it: any) => {
                    acc[it.id] = {
                      approvedPointsValue:
                        itemState[it.id]?.approvedPoints ?? 0,
                      remarkValue: itemState[it.id]?.remark || "",
                      onApprovedPointsChange: (value: number) =>
                        updateItem(it.id, { approvedPoints: value }),
                      onRemarkChange: (value: string) =>
                        updateItem(it.id, { remark: value }),
                    };
                    return acc;
                  }, {})
                : undefined
            }
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {error && <div className="text-sm text-danger">{error}</div>}
          {message && <div className="text-sm text-success">{message}</div>}
          {!canEdit && (
            <div className="text-sm text-text-2">
              This appraisal is fully approved. HR can view it only.
            </div>
          )}
        </div>
        {canEdit ? (
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Submit HR Review
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default HRReviewDetail;
