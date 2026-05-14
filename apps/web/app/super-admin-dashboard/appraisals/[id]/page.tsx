"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Save, ArrowLeft, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function fullEvidenceUrl(url: string) {
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

interface AppraisalDetail {
  id: string;
  status: string;
  finalScore: number | null;
  finalPercent: number;
  currentSalary: number;
  revisedSalary: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    department?: { id: string; name: string } | null;
    facultyProfile?: {
      currentSalary?: number;
      lastIncrementDate?: string;
    } | null;
  };
  cycle: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  items: Array<{
    id: string;
    key: string;
    points: number;
    notes?: string;
  }>;
  superAdminApprovedPercent?: number | null;
  superAdminRemark?: string | null;
}

function SuperAdminAppraisalDetail() {
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

  const [appraisal, setAppraisal] = useState<AppraisalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adjustedPercent, setAdjustedPercent] = useState<number | undefined>();
  const [remark, setRemark] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const response = await api.superAdmin.getById(id);
        if (!active) return;
        setAppraisal(response.data);
        setAdjustedPercent(
          response.data?.superAdminApprovedPercent ?? undefined,
        );
        setRemark(response.data?.superAdminRemark || "");
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

  const finalPercent = adjustedPercent ?? appraisal?.finalPercent ?? 0;
  const revisedSalary = appraisal
    ? appraisal.currentSalary + (appraisal.currentSalary * finalPercent) / 100
    : 0;
  const salaryIncrement = revisedSalary - (appraisal?.currentSalary ?? 0);

  async function handleApprove() {
    if (!appraisal) return;

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      await api.superAdmin.approve(appraisal.id, {
        adjustedPercent:
          adjustedPercent !== undefined &&
          adjustedPercent !== appraisal.finalPercent
            ? adjustedPercent
            : undefined,
        remark: remark.trim() || undefined,
      });

      setMessage("Appraisal approved successfully!");
      setTimeout(() => {
        router.push("/super-admin-dashboard/appraisals");
      }, 2000);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to approve",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex items-center gap-3 text-text-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading appraisal...</span>
        </div>
      </div>
    );
  }

  if (!appraisal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <p className="text-sm text-danger">Appraisal not found</p>
          <Link
            href="/super-admin-dashboard/appraisals"
            className="mt-4 inline-block text-xs font-medium text-brand underline"
          >
            Back to appraisals
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/super-admin-dashboard/appraisals"
          className="rounded-lg p-2 hover:bg-surface"
        >
          <ArrowLeft className="h-5 w-5 text-text-2" />
        </Link>
        <PageHeader
          title="Super Admin Appraisal Review"
          subtitle={`Reviewing appraisal for ${appraisal.user.firstName} ${appraisal.user.lastName}`}
          actions={undefined}
        />
      </div>

      <div className="mx-auto max-w-6xl space-y-6">
        {error && (
          <div className="rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-success/20 bg-success-bg p-4 text-sm text-success">
            {message}
          </div>
        )}

        {/* Faculty & Cycle Info */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Faculty Information
              </p>
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-xs text-text-3">Name</p>
                  <p className="font-medium text-text">
                    {appraisal.user.firstName} {appraisal.user.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-3">Email</p>
                  <p className="text-sm text-text">{appraisal.user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-text-3">Department</p>
                  <p className="text-sm text-text">
                    {appraisal.user.department?.name || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Appraisal Cycle
              </p>
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-xs text-text-3">Cycle Name</p>
                  <p className="font-medium text-text">
                    {appraisal.cycle.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-3">Period</p>
                  <p className="text-sm text-text">
                    {new Date(appraisal.cycle.startDate).toLocaleDateString()} -{" "}
                    {new Date(appraisal.cycle.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Appraisal Scores Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
              Final Score (HR Approved)
            </p>
            <p className="mt-2 text-2xl font-bold text-text">
              {appraisal.finalScore?.toFixed(2) ?? 0}
            </p>
            <p className="mt-1 text-xs text-text-2">Out of 4</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
              Approved Percentage
            </p>
            <p className="mt-2 text-2xl font-bold text-brand">
              {appraisal.finalPercent?.toFixed(1) ?? 0}%
            </p>
            <p className="mt-1 text-xs text-text-2">HR recommended</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
              Current Status
            </p>
            <p className="mt-2 inline-block rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">
              {appraisal.status === "SUPER_ADMIN_PENDING"
                ? "Pending Approval"
                : "Approved"}
            </p>
          </div>
        </div>

        {/* Salary Information */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Salary Calculation
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-bg p-4">
              <p className="text-xs text-text-3">Current Salary</p>
              <p className="mt-1 text-2xl font-bold text-text">
                ₹{appraisal.currentSalary?.toLocaleString("en-IN") ?? 0}
              </p>
            </div>

            <div className="rounded-lg bg-bg p-4">
              <p className="text-xs text-text-3">Approved Increment %</p>
              <p className="mt-1 text-2xl font-bold text-text">
                {finalPercent.toFixed(1)}%
              </p>
            </div>

            <div className="rounded-lg bg-success/10 p-4">
              <p className="text-xs text-text-3">Increment Amount</p>
              <p className="mt-1 text-2xl font-bold text-success">
                ₹
                {salaryIncrement.toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="rounded-lg bg-brand/10 p-4">
              <p className="text-xs text-text-3">Revised Salary</p>
              <p className="mt-1 text-2xl font-bold text-brand">
                ₹
                {revisedSalary.toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Approval Controls */}
        {appraisal.status === "SUPER_ADMIN_PENDING" && (
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
              Approval Actions
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text">
                  Adjust Approval Percentage (Optional)
                </label>
                <p className="mt-1 text-xs text-text-2">
                  Leave blank to use HR recommended{" "}
                  {appraisal.finalPercent?.toFixed(1)}%
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={adjustedPercent !== undefined ? adjustedPercent : ""}
                    onChange={(e) => {
                      const val = e.target.value
                        ? parseFloat(e.target.value)
                        : undefined;
                      setAdjustedPercent(val);
                    }}
                    placeholder={appraisal.finalPercent?.toFixed(1)}
                    className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder-text-3"
                  />
                  <span className="flex items-center text-text-2">%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text">
                  Approval Remarks (Optional)
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Add any remarks about the approval..."
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder-text-3"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-success px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Approving..." : "Approve Appraisal"}
                </button>

                <Link
                  href="/super-admin-dashboard/appraisals"
                  className="flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 font-medium text-text hover:bg-bg"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Already Approved Info */}
        {appraisal.status === "FULLY_APPROVED" && (
          <div className="rounded-2xl border border-success/20 bg-success-bg p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-success">
              Approval Complete
            </p>
            <p className="mt-2 text-sm text-success">
              This appraisal has been approved. The faculty salary has been
              updated to ₹
              {revisedSalary.toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
              .
            </p>
            {appraisal.superAdminRemark && (
              <div className="mt-3 rounded-lg bg-success/10 p-3">
                <p className="text-xs font-medium text-text-3">
                  Approval Remark
                </p>
                <p className="mt-1 text-sm text-text">
                  {appraisal.superAdminRemark}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SuperAdminAppraisalDetail;
