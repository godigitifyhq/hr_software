"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  SendHorizontal,
  Upload,
  X,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";
import type {
  FacultyAppraisalPolicy,
  FacultyAppraisalRequestStatus,
  FacultyEvidenceUpload,
} from "@svgoi/shared-types";

type CriterionState = {
  selectedValue: string;
  points: number;
  uploading: boolean;
  evidence: FacultyEvidenceUpload[] | null;
  remarks: string;
};

type PendingUpload = {
  criterionKey: string;
  files: File[];
};

function HodSelfRequestPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [policy, setPolicy] = useState<FacultyAppraisalPolicy | null>(null);
  const [status, setStatus] = useState<FacultyAppraisalRequestStatus | null>(
    null,
  );
  const [criteriaState, setCriteriaState] = useState<
    Record<string, CriterionState>
  >({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(
    null,
  );
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [policyResponse, statusResponse] = await Promise.all([
          api.faculty.getAppraisalPolicy(),
          api.faculty.getAppraisalStatus(),
        ]);

        if (!active) {
          return;
        }

        const policyData = policyResponse.data;
        setPolicy(policyData);
        setStatus(statusResponse.data);

        const initialState: Record<string, CriterionState> = {};
        policyData.criteria.forEach((criterion) => {
          initialState[criterion.key] = {
            selectedValue: "",
            points: 0,
            uploading: false,
            evidence: null,
            remarks: "",
          };
        });
        setCriteriaState(initialState);
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load self appraisal form",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  const totalPoints = useMemo(
    () =>
      Object.values(criteriaState).reduce((sum, item) => sum + item.points, 0),
    [criteriaState],
  );

  const canSubmit = useMemo(() => {
    if (!policy) {
      return false;
    }

    return policy.criteria.every(
      (criterion) => criteriaState[criterion.key]?.selectedValue,
    );
  }, [criteriaState, policy]);

  const incrementPercent = useMemo(() => {
    if (!policy) {
      return 0;
    }

    const bracket = policy.incrementBrackets.find((entry) => {
      const lower = totalPoints >= entry.min;
      const upper =
        typeof entry.max === "number" ? totalPoints <= entry.max : true;
      return lower && upper;
    });
    return bracket?.incrementPercent ?? 0;
  }, [policy, totalPoints]);

  function updateCriterionRemarks(criterionKey: string, remarks: string) {
    setCriteriaState((current) => ({
      ...current,
      [criterionKey]: {
        ...current[criterionKey],
        remarks,
      },
    }));
  }

  function updateCriterionSelection(
    criterionKey: string,
    selectedValue: string,
  ) {
    if (!policy) {
      return;
    }

    const criterion = policy.criteria.find(
      (entry) => entry.key === criterionKey,
    );
    const option = criterion?.options.find(
      (entry) => entry.value === selectedValue,
    );

    setCriteriaState((current) => ({
      ...current,
      [criterionKey]: {
        ...current[criterionKey],
        selectedValue,
        points: option?.points ?? 0,
      },
    }));
  }

  async function uploadEvidence(criterionKey: string, file: File) {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG, and PDF evidence files are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Evidence file size must be 5MB or less.");
      return;
    }

    setError(null);
    setMessage(null);
    setCriteriaState((current) => ({
      ...current,
      [criterionKey]: {
        ...current[criterionKey],
        uploading: true,
      },
    }));

    try {
      const response = await api.faculty.uploadAppraisalEvidence(
        criterionKey,
        file,
      );
      setCriteriaState((current) => ({
        ...current,
        [criterionKey]: {
          ...current[criterionKey],
          uploading: false,
          evidence: [...(current[criterionKey]?.evidence ?? []), response.data],
        },
      }));
    } catch (uploadError: any) {
      setCriteriaState((current) => ({
        ...current,
        [criterionKey]: {
          ...current[criterionKey],
          uploading: false,
        },
      }));
      setError(
        uploadError?.response?.data?.message ||
          uploadError?.message ||
          "Failed to upload evidence",
      );
    }
  }

  async function submitRequest() {
    if (!policy || !canSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);

      const items = policy.criteria.map((criterion) => ({
        criterionKey: criterion.key,
        selectedValue: criteriaState[criterion.key].selectedValue,
        evidence: criteriaState[criterion.key].evidence,
        remarks: criteriaState[criterion.key].remarks?.trim() || null,
      }));

      await api.faculty.submitAppraisalRequest({ items });
      const statusResponse = await api.faculty.getAppraisalStatus();
      setStatus(statusResponse.data);
      setMessage("Self appraisal request submitted successfully.");
    } catch (submitError: any) {
      setError(
        submitError?.response?.data?.message ||
          submitError?.message ||
          "Failed to submit self appraisal request",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPendingUpload() {
    if (!pendingUpload) {
      setConfirmUploadOpen(false);
      return;
    }

    const upload = pendingUpload;
    setPendingUpload(null);
    setConfirmUploadOpen(false);
    for (const file of upload.files) {
      // eslint-disable-next-line no-await-in-loop
      await uploadEvidence(upload.criterionKey, file);
    }
  }

  function removeEvidence(criterionKey: string, idx: number) {
    setCriteriaState((current) => ({
      ...current,
      [criterionKey]: {
        ...current[criterionKey],
        evidence: (current[criterionKey]?.evidence ?? []).filter((_, i) => i !== idx),
      },
    }));
  }

  if (loading) {
    return (
      <AppShell role={role}>
        <PageHeader
          title="Request Self Appraisal"
          subtitle="Loading criteria and policy..."
        />
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading form...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="Request Self Appraisal"
        subtitle="Select one option for each criterion and upload supporting evidence."
        actions={
          <Link
            href="/hod-review"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        }
      />

      {status?.hasRequest ? (
        <section className="rounded-2xl border border-success/20 bg-success-bg p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-success">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-semibold">
                  Self appraisal submitted for this cycle.
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-success/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Status</p>
                  <p className="mt-1 text-sm font-bold">{status.status?.replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-xl bg-success/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Total Points</p>
                  <p className="mt-1 text-sm font-bold">{status.totalPoints ?? 0}</p>
                </div>
                <div className="rounded-xl bg-success/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Increment</p>
                  <p className="mt-1 text-sm font-bold">{status.incrementPercent ?? 0}%</p>
                </div>
              </div>
            </div>
            {status.appraisalId ? (
              <Link
                href={`/faculty-dashboard/appraisals/${status.appraisalId}/view`}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-success/30 bg-white/60 px-4 text-sm font-medium text-success transition hover:bg-white/90"
              >
                View Form
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <>
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
                Total Points
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-text">
                {totalPoints}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Max Points
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-text">
                {policy?.maxPoints ?? 68}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Expected Increment
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-text">
                {incrementPercent}%
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {policy?.criteria.map((criterion) => {
              const state = criteriaState[criterion.key];

              return (
                <section
                  key={criterion.key}
                  className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-text">
                        {criterion.heading}
                      </h3>
                      <label className="mt-3 block text-sm font-medium text-text">
                        Criteria
                      </label>
                      <select
                        value={state?.selectedValue || ""}
                        aria-label={`${criterion.heading} criteria`}
                        onChange={(event) =>
                          updateCriterionSelection(
                            criterion.key,
                            event.target.value,
                          )
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
                      >
                        <option value="">Select criteria</option>
                        {criterion.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-text">
                          Remarks / Notes
                        </label>
                        <textarea
                          rows={2}
                          value={state?.remarks ?? ""}
                          placeholder="Type Your Remarks here"
                          onChange={(event) =>
                            updateCriterionRemarks(
                              criterion.key,
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:bg-surface-2">
                          {state?.uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {state?.uploading
                            ? "Uploading..."
                            : "Upload evidence"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const files = Array.from(
                                event.target.files || [],
                              );
                              if (files.length > 0) {
                                setPendingUpload({
                                  criterionKey: criterion.key,
                                  files,
                                });
                                setConfirmUploadOpen(true);
                              }
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <p className="mt-1 text-xs text-text-3">
                          JPG, PNG, or PDF. Max 5MB.
                        </p>
                        {state?.evidence && state.evidence.length > 0 ? (
                          <div className="mt-2 flex flex-col gap-1.5 text-xs">
                            {state.evidence.map((e, idx) => (
                              <div
                                key={`${e.fileName}-${idx}`}
                                className="flex items-center gap-2"
                              >
                                <p className="truncate text-success">{e.fileName}</p>
                                {(e.viewUrl || e.url || e.directUrl) && (
                                  <a
                                    href={e.viewUrl || e.url || e.directUrl || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand hover:text-brand-dark"
                                  >
                                    View file
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  aria-label="Remove evidence"
                                  onClick={() => removeEvidence(criterion.key, idx)}
                                  className="ml-auto shrink-0 rounded p-0.5 text-text-3 transition hover:bg-danger-bg hover:text-danger"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl bg-brand-light p-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                        Points Awarded
                      </p>
                      <p className="mt-2 font-display text-3xl font-bold text-brand">
                        {state?.points ?? 0}
                      </p>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="sticky bottom-0 mt-8 rounded-2xl border border-border bg-surface/95 p-4 shadow-modal backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-text-2">
                Total selected points: {totalPoints} | Expected increment:{" "}
                {incrementPercent}%
              </p>
              <button
                type="button"
                onClick={() => void submitRequest()}
                disabled={!canSubmit || submitting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
                {submitting ? "Submitting..." : "Submit Self Appraisal"}
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmUploadOpen}
        title="Confirm evidence upload"
        description={
          pendingUpload
            ? pendingUpload.files.length > 1
              ? `Upload ${pendingUpload.files.length} files for this criterion? These files will be shared with reviewers.`
              : `Upload ${pendingUpload.files[0].name} for this criterion? This file will be shared with reviewers.`
            : "Upload this evidence file?"
        }
        confirmLabel="Upload file"
        onCancel={() => {
          setConfirmUploadOpen(false);
          setPendingUpload(null);
        }}
        onConfirm={() => {
          void confirmPendingUpload();
        }}
      />
    </AppShell>
  );
}

export default withAuth(HodSelfRequestPage, ["HOD"]);
