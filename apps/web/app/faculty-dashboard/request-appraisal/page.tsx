"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  SendHorizontal,
  Upload,
  XCircle,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui";
import { api, type FacultyCycleSummary } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { toDriveViewerUrl } from "@/lib/utils/drive";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";
import type {
  FacultyAppraisalPolicy,
  FacultyEvidenceUpload,
} from "@svgoi/shared-types";

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
    return toDriveViewerUrl(normalizeDriveUrl(url));
  }
  if (url.startsWith("/")) {
    return toDriveViewerUrl(`${API_ORIGIN}${url}`);
  }
  return toDriveViewerUrl(url);
}

const SUBMITTED_STATUSES = new Set([
  "HOD_REVIEW",
  "COMMITTEE_REVIEW",
  "HR_FINALIZED",
  "SUPER_ADMIN_PENDING",
  "FULLY_APPROVED",
  "CLOSED",
  "SUBMITTED",
]);

function cycleStatusLabel(entry: FacultyCycleSummary): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (!entry.appraisal) {
    return entry.cycle.isActive
      ? { label: "Pending", color: "text-blue-700", bgColor: "bg-blue-50" }
      : { label: "Not Submitted", color: "text-gray-500", bgColor: "bg-gray-100" };
  }
  const s = entry.appraisal.status;
  if (s === "DRAFT") {
    return { label: "Draft", color: "text-orange-700", bgColor: "bg-orange-50" };
  }
  if (s === "HOD_REVIEW" || s === "COMMITTEE_REVIEW") {
    return { label: "Under Review", color: "text-yellow-700", bgColor: "bg-yellow-50" };
  }
  if (s === "HR_FINALIZED" || s === "FULLY_APPROVED" || s === "CLOSED") {
    return { label: "Finalized", color: "text-green-700", bgColor: "bg-green-50" };
  }
  return { label: s.replace(/_/g, " "), color: "text-text-2", bgColor: "bg-surface" };
}

function FacultyAppraisalRequestPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  const [cycles, setCycles] = useState<FacultyCycleSummary[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [cyclesError, setCyclesError] = useState<string | null>(null);

  const [selectedCycle, setSelectedCycle] = useState<FacultyCycleSummary | null>(null);
  const [policy, setPolicy] = useState<FacultyAppraisalPolicy | null>(null);
  const [criteriaState, setCriteriaState] = useState<Record<string, CriterionState>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCycles() {
      try {
        setCyclesLoading(true);
        setCyclesError(null);
        const response = await api.faculty.getCycles();
        if (active) {
          setCycles(response.data);
        }
      } catch (err: any) {
        if (active) {
          setCyclesError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load appraisal cycles",
          );
        }
      } finally {
        if (active) {
          setCyclesLoading(false);
        }
      }
    }

    void loadCycles();
    return () => {
      active = false;
    };
  }, []);

  async function openForm(entry: FacultyCycleSummary) {
    setSelectedCycle(entry);
    setFormLoading(true);
    setError(null);
    setMessage(null);

    try {
      const policyResponse = await api.faculty.getAppraisalPolicy();
      setPolicy(policyResponse.data);

      const initialState: Record<string, CriterionState> = {};
      policyResponse.data.criteria.forEach((criterion) => {
        initialState[criterion.key] = {
          selectedValue: "",
          points: 0,
          uploading: false,
          evidence: null,
        };
      });
      setCriteriaState(initialState);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load form",
      );
    } finally {
      setFormLoading(false);
    }
  }

  function closeForm() {
    setSelectedCycle(null);
    setPolicy(null);
    setCriteriaState({});
    setError(null);
    setMessage(null);
  }

  const totalPoints = useMemo(
    () =>
      Object.values(criteriaState).reduce((sum, item) => sum + item.points, 0),
    [criteriaState],
  );

  const canSubmit = useMemo(() => {
    if (!policy) return false;
    return policy.criteria.every(
      (criterion) => criteriaState[criterion.key]?.selectedValue,
    );
  }, [criteriaState, policy]);

  const incrementPercent = useMemo(() => {
    if (!policy) return 0;
    const bracket = policy.incrementBrackets.find((entry) => {
      const lower = totalPoints >= entry.min;
      const upper =
        typeof entry.max === "number" ? totalPoints <= entry.max : true;
      return lower && upper;
    });
    return bracket?.incrementPercent ?? 0;
  }, [policy, totalPoints]);

  function updateCriterionSelection(criterionKey: string, selectedValue: string) {
    if (!policy) return;
    const criterion = policy.criteria.find((entry) => entry.key === criterionKey);
    const option = criterion?.options.find((entry) => entry.value === selectedValue);
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
      [criterionKey]: { ...current[criterionKey], uploading: true },
    }));

    try {
      const response = await api.faculty.uploadAppraisalEvidence(criterionKey, file);
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
        [criterionKey]: { ...current[criterionKey], uploading: false },
      }));
      setError(
        uploadError?.response?.data?.message ||
          uploadError?.message ||
          "Failed to upload evidence",
      );
    }
  }

  async function submitRequest() {
    if (!policy || !canSubmit) return;

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
      setMessage("Appraisal submitted successfully.");

      const updatedCycles = await api.faculty.getCycles();
      setCycles(updatedCycles.data);
      closeForm();
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

  if (cyclesLoading) {
    return (
      <AppShell role={role}>
        <PageHeader title="Appraisal Cycles" subtitle="Loading your appraisal history..." />
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading cycles...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  if (cyclesError) {
    return (
      <AppShell role={role}>
        <PageHeader title="Appraisal Cycles" />
        <div className="rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {cyclesError}
        </div>
      </AppShell>
    );
  }

  /* ---- Inline appraisal form ---- */
  if (selectedCycle) {
    return (
      <AppShell role={role}>
        <PageHeader
          title={`Submit Appraisal — ${selectedCycle.cycle.name}`}
          subtitle="Select one option per criterion and upload supporting evidence."
          actions={
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to cycles
            </button>
          }
        />

        {formLoading ? (
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3 text-text-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading form...</span>
            </div>
          </div>
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
                  {policy?.maxPoints ?? 44}
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
                            updateCriterionSelection(criterion.key, event.target.value)
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
                            {state?.uploading ? "Uploading..." : "Upload evidence"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,application/pdf"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  setPendingUpload({ criterionKey: criterion.key, file });
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
                                  href={resolveEvidenceUrl(
                                    state.evidence.viewUrl ||
                                      state.evidence.url ||
                                      state.evidence.directUrl ||
                                      "",
                                  )}
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

  /* ---- Cycles list view ---- */
  return (
    <AppShell role={role}>
      <PageHeader
        title="Appraisal Cycles"
        subtitle="View and manage your appraisals across all cycles."
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

      {cycles.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-text-3" />
            <p className="text-sm text-text-2">
              No appraisal cycles have been created yet. Please check back later.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {cycles.map((entry) => {
            const { label, color, bgColor } = cycleStatusLabel(entry);
            const isSubmitted =
              entry.appraisal && SUBMITTED_STATUSES.has(entry.appraisal.status);
            const canStart = entry.cycle.isActive && !entry.appraisal;

            return (
              <div
                key={entry.cycle.id}
                className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-display text-lg font-semibold text-text">
                        {entry.cycle.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full ${bgColor} ${color} px-3 py-1 text-xs font-semibold`}
                      >
                        {entry.cycle.isActive ? (
                          <Clock className="h-3 w-3" />
                        ) : isSubmitted ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-text-3">
                      {new Date(entry.cycle.startDate).toLocaleDateString()} –{" "}
                      {new Date(entry.cycle.endDate).toLocaleDateString()}
                    </p>
                    {entry.appraisal ? (
                      <p className="mt-1 text-sm text-text-2">
                        Status: {entry.appraisal.status.replace(/_/g, " ")}
                        {entry.appraisal.submittedAt &&
                          ` • Submitted ${new Date(entry.appraisal.submittedAt).toLocaleDateString()}`}
                        {entry.appraisal.finalScore != null &&
                          ` • Score: ${entry.appraisal.finalScore}`}
                        {entry.appraisal.finalPercent != null &&
                          ` • Increment: ${entry.appraisal.finalPercent}%`}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    {isSubmitted && entry.appraisal ? (
                      <Link
                        href={`/faculty-dashboard/appraisals/${entry.appraisal.id}/view`}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Appraisal
                      </Link>
                    ) : canStart ? (
                      <button
                        type="button"
                        onClick={() => void openForm(entry)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
                      >
                        <SendHorizontal className="h-4 w-4" />
                        Start Appraisal
                      </button>
                    ) : !entry.cycle.isActive && !entry.appraisal ? (
                      <span className="text-sm text-text-3">
                        Cycle ended — not submitted
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

export default withAuth(FacultyAppraisalRequestPage, ["FACULTY"]);
