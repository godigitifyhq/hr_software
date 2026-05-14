"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  SendHorizontal,
  Upload,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui";
import { api, type AppraisalSummary } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";
import type {
  FacultyAppraisalPolicy,
  FacultyAppraisalRequestStatus,
  FacultyEvidenceUpload,
} from "@svgoi/shared-types";
import type { FacultyAppraisalDetail } from "@/lib/api";

type CriterionState = {
  selectedValue: string;
  points: number;
  uploading: boolean;
  evidence: FacultyEvidenceUpload | null;
};

type PendingUpload = {
  criterionKey: string;
  file: File;
};

function toDriveProxy(url: string) {
  try {
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const q = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = m?.[1] ?? q?.[1];
    if (!fileId) return url;
    return `${API_ORIGIN}/api/v1/drive/${fileId}`;
  } catch {
    return url;
  }
}

function normalizeDriveUrl(value: string) {
  if (
    value.includes("drive.google.com/uc") ||
    value.includes("lh3.googleusercontent.com")
  ) {
    const q = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (q && q[1]) {
      return toDriveProxy(`https://drive.google.com/uc?export=view&id=${q[1]}`);
    }
    const normalized = value.replace("export=download", "export=view");
    return toDriveProxy(normalized);
  }

  const m = value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) {
    return toDriveProxy(`https://drive.google.com/uc?export=view&id=${m[1]}`);
  }
  const q2 = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (q2 && q2[1]) {
    return toDriveProxy(`https://drive.google.com/uc?export=view&id=${q2[1]}`);
  }

  return value;
}

function resolveEvidenceUrl(url: string) {
  if (!url) return url;
  if (url.startsWith("http")) {
    return normalizeDriveUrl(url);
  }
  if (url.startsWith("/")) {
    return `${API_ORIGIN}${url}`;
  }
  return url;
}

function FacultyAppraisalRequestPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [policy, setPolicy] = useState<FacultyAppraisalPolicy | null>(null);
  const [status, setStatus] = useState<FacultyAppraisalRequestStatus | null>(
    null,
  );
  const [submitted, setSubmitted] = useState<FacultyAppraisalDetail | null>(
    null,
  );
  const [appraisals, setAppraisals] = useState<AppraisalSummary[]>([]);
  const [appraisalsLoading, setAppraisalsLoading] = useState(false);
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
  const [expandedAppraisals, setExpandedAppraisals] = useState<string[]>([]);

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

        if (statusResponse.data.hasRequest && statusResponse.data.appraisalId) {
          const detailsResponse = await api.faculty.getAppraisalDetails(
            statusResponse.data.appraisalId,
          );
          if (active) {
            setSubmitted(detailsResponse.data);
          }
        }

        setAppraisalsLoading(true);
        const listResponse = await api.appraisals.list();
        if (active) {
          const appraisalsData = listResponse.data ?? [];
          setAppraisals(appraisalsData);

          // Expand the first submitted appraisal by default
          const firstSubmitted = appraisalsData.find(
            (a) => a.status !== "DRAFT",
          );
          if (firstSubmitted && active) {
            setExpandedAppraisals([firstSubmitted.id]);
          }
        }

        const initialState: Record<string, CriterionState> = {};
        policyData.criteria.forEach((criterion) => {
          initialState[criterion.key] = {
            selectedValue: "",
            points: 0,
            uploading: false,
            evidence: null,
          };
        });
        setCriteriaState(initialState);
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load appraisal request form",
          );
        }
      } finally {
        if (active) {
          setAppraisalsLoading(false);
        }
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

  const submittedAppraisals = useMemo(
    () => appraisals.filter((appraisal) => appraisal.status !== "DRAFT"),
    [appraisals],
  );

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
          evidence: response.data,
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
      }));

      await api.faculty.submitAppraisalRequest({ items });
      const statusResponse = await api.faculty.getAppraisalStatus();
      setStatus(statusResponse.data);
      if (statusResponse.data.hasRequest && statusResponse.data.appraisalId) {
        const detailsResponse = await api.faculty.getAppraisalDetails(
          statusResponse.data.appraisalId,
        );
        setSubmitted(detailsResponse.data);
      }
      setMessage("Appraisal request submitted successfully.");
    } catch (submitError: any) {
      setError(
        submitError?.response?.data?.message ||
          submitError?.message ||
          "Failed to submit appraisal request",
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
    await uploadEvidence(upload.criterionKey, upload.file);
  }

  function toggleAppraisalExpanded(appraisalId: string) {
    setExpandedAppraisals((prev) => {
      if (prev.includes(appraisalId)) {
        return prev.filter((id) => id !== appraisalId);
      } else {
        return [...prev, appraisalId];
      }
    });
  }

  if (loading) {
    return (
      <AppShell role={role}>
        <PageHeader
          title="Request Appraisal"
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
        title="Request Appraisal"
        subtitle="Select one option for each criterion and upload supporting evidence."
        actions={
          <Link
            href="/faculty-dashboard"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        }
      />

      {/* Submitted Appraisals Section - Display First */}
      <section className="mb-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">
            Submitted Appraisals
          </h2>
          <Link
            href="/appraisals"
            className="text-xs font-semibold text-brand hover:text-brand-dark"
          >
            View all
          </Link>
        </div>

        {appraisalsLoading ? (
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3 text-text-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading appraisals...</span>
            </div>
          </div>
        ) : submittedAppraisals.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-text-2">
              No appraisal submitted yet for the current active cycle. Submit
              your appraisal below to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {submittedAppraisals.map((appraisal) => {
              const isExpanded = expandedAppraisals.includes(appraisal.id);
              const statusColor =
                appraisal.status === "SUBMITTED"
                  ? "text-orange-600"
                  : appraisal.status === "HR_FINALIZED"
                  ? "text-success"
                  : "text-blue-600";

              return (
                <div
                  key={appraisal.id}
                  className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleAppraisalExpanded(appraisal.id)}
                    className="w-full px-5 py-4 text-left transition hover:bg-surface-2 cursor-pointer active:bg-surface-2 flex items-center justify-between group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-text">
                          {appraisal.cycle?.name ?? "Appraisal"}
                        </h3>
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {appraisal.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-3">
                        Submitted:{" "}
                        {appraisal.submittedAt
                          ? new Date(appraisal.submittedAt).toLocaleDateString()
                          : "Not submitted"}
                        {appraisal.finalScore !== null &&
                          ` • Score: ${appraisal.finalScore}`}
                        {appraisal.finalPercent !== null &&
                          ` • Increment: ${appraisal.finalPercent}%`}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-text-3 transition-transform duration-300 group-hover:text-text-2 flex-shrink-0 ml-2 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isExpanded && appraisal.items && (
                    <div className="border-t border-border px-5 py-4 bg-surface-2">
                      <div className="space-y-3 mb-4">
                        {appraisal.items.map((item, index) => (
                          <div key={index} className="text-sm">
                            <p className="font-medium text-text">
                              {item.label || `Item ${index + 1}`}
                            </p>
                            <p className="mt-1 text-text-2">
                              Points: {item.selfScore ?? 0} / {item.weight}
                            </p>
                          </div>
                        ))}
                      </div>
                      <Link
                        href={`/faculty-dashboard/appraisals/${appraisal.id}/view`}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv transition hover:bg-brand-dark"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Full Details
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {status?.hasRequest ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-success/20 bg-success-bg p-6 text-success">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-medium">
                You have already requested appraisal for this cycle.
              </p>
            </div>
            <p className="mt-2 text-sm">
              Status: {status.status} | Total points: {status.totalPoints ?? 0}{" "}
              | Increment: {status.incrementPercent ?? 0}%
            </p>
          </div>

          {submitted ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Submitted Form
                </p>
                <p className="mt-1 text-sm text-text-2">
                  Submitted on {submitted.submittedAt ?? "-"} | Final score:{" "}
                  {submitted.finalScore ?? "-"} | Final percent:{" "}
                  {submitted.finalPercent ?? "-"}%
                </p>
              </div>

              {submitted.items.map((item) => (
                <section
                  key={item.id}
                  className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-text">
                        {item.heading}
                      </h3>
                      <p className="mt-2 text-sm text-text-2">
                        Selected: {item.selectedLabel || item.selectedValue}
                      </p>
                      <p className="mt-1 text-sm text-text-3">
                        Points: {item.facultyPoints}
                      </p>
                      {item.evidence.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.evidence.map((evidence, index) => {
                            const url =
                              evidence.viewUrl ||
                              evidence.url ||
                              evidence.directUrl;
                            if (!url) return null;
                            return (
                              <a
                                key={`${item.id}-evidence-${index}`}
                                href={resolveEvidenceUrl(url)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-brand hover:text-brand-dark"
                              >
                                {evidence.fileName || "Evidence"}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Next Appraisal Cycle
                </p>
                <p className="mt-2 text-sm text-text-2">
                  You have already submitted for the{" "}
                  <strong>{status.status?.replace(/_/g, " ")}</strong> in the
                  current cycle.
                </p>
                <p className="mt-1 text-xs text-text-3">
                  The next appraisal cycle (e.g., 2026-2027) will be available
                  soon. HR will notify you when it opens.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled
              title="This button will be enabled when the next appraisal cycle opens by HR"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-5 text-sm font-medium text-text-2 opacity-60 cursor-not-allowed"
            >
              <Loader2 className="h-4 w-4" />
              Waiting for Next Cycle...
            </button>
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
                {policy?.maxPoints ?? 48}
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
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                setPendingUpload({
                                  criterionKey: criterion.key,
                                  file,
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
                        {state?.evidence ? (
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                            <p className="text-success">
                              Uploaded: {state.evidence.fileName}
                            </p>
                            {(state.evidence.viewUrl ||
                              state.evidence.url ||
                              state.evidence.directUrl) && (
                              <a
                                href={
                                  state.evidence.viewUrl ||
                                  state.evidence.url ||
                                  state.evidence.directUrl ||
                                  "#"
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-dark"
                              >
                                View file
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
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
                {submitting ? "Submitting..." : "Submit Appraisal Request"}
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
            ? `Upload ${pendingUpload.file.name} for this criterion? This file will be shared with reviewers.`
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

export default withAuth(FacultyAppraisalRequestPage, ["FACULTY"]);
