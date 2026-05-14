"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";
import type { AppraisalSummary } from "@/lib/api";

interface AppraisalWithSalary extends AppraisalSummary {
  currentSalary?: number;
}

function SuperAdminAppraislalsPage() {
  const router = useRouter();
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  const [appraisals, setAppraisals] = useState<AppraisalWithSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("SUPER_ADMIN_PENDING");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [cycleFilter, setCycleFilter] = useState<string>("");
  const [departments, setDepartments] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [cycles, setCycles] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }

    if (!session.user.roles.includes("SUPER_ADMIN")) {
      router.push("/unauthorized");
      return;
    }

    loadAppraisals();
    loadFilters();
  }, [session, router]);

  async function loadAppraisals() {
    try {
      setLoading(true);
      setError(null);
      const response = await api.superAdmin.getAppraisals({
        status: statusFilter,
        departmentId: departmentFilter || undefined,
        cycleId: cycleFilter || undefined,
      });
      setAppraisals(response.data ?? []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load appraisals"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadFilters() {
    try {
      const [deptsRes, cyclesRes] = await Promise.all([
        api.departments.list(),
        api.appraisals.list(),
      ]);

      const uniqueDepts = deptsRes.data ? Array.from(new Set(
        deptsRes.data.map((d: any) => d.name)
      )) : [];
      const uniqueCycles = cyclesRes.data ? Array.from(new Set(
        cyclesRes.data.map((a: any) => a.cycle?.name)
      )).filter(Boolean) : [];

      setDepartments(
        deptsRes.data?.map((d: any) => ({ id: d.id, name: d.name })) ?? []
      );
      setCycles(
        cyclesRes.data
          ?.map((a: any) => a.cycle)
          .filter((c: any) => c)
          .reduce((acc: any, c: any) => {
            const existing = acc.find((x: any) => x.id === c.id);
            if (!existing) acc.push(c);
            return acc;
          }, []) ?? []
      );
    } catch (err) {
      console.error("Failed to load filters:", err);
    }
  }

  const pendingCount = useMemo(
    () => appraisals.filter((a) => a.status === "SUPER_ADMIN_PENDING").length,
    [appraisals]
  );

  const approvedCount = useMemo(
    () => appraisals.filter((a) => a.status === "FULLY_APPROVED").length,
    [appraisals]
  );

  const totalSalaryImpact = useMemo(() => {
    return appraisals.reduce((sum, a) => {
      const currentSalary = a.currentSalary ?? 0;
      const percent = a.finalPercent ?? 0;
      const increment = (currentSalary * percent) / 100;
      return sum + increment;
    }, 0);
  }, [appraisals]);

  return (
    <AppShell role={role}>
      <PageHeader
        title="Super Admin Dashboard"
        subtitle="Review and approve faculty appraisals with optional percentage adjustments."
        actions={undefined}
      />

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Pending Approval
          </p>
          <p className="mt-2 text-2xl font-bold text-text">{pendingCount}</p>
          <p className="text-xs text-text-3">
            {pendingCount} appraisal{pendingCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Fully Approved
          </p>
          <p className="mt-2 text-2xl font-bold text-success">{approvedCount}</p>
          <p className="text-xs text-text-3">
            {approvedCount} appraisal{approvedCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Total Salary Impact
          </p>
          <p className="mt-2 text-2xl font-bold text-brand">
            ₹{Math.round(totalSalaryImpact).toLocaleString()}
          </p>
          <p className="text-xs text-text-3">
            Total increment amount
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Total Appraisals
          </p>
          <p className="mt-2 text-2xl font-bold text-text">
            {appraisals.length}
          </p>
          <p className="text-xs text-text-3">
            In this view
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="status-filter" className="block text-xs font-semibold uppercase tracking-widest text-text-3">
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                loadAppraisals();
              }}
              className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
            >
              <option value="SUPER_ADMIN_PENDING">Pending Approval</option>
              <option value="FULLY_APPROVED">Fully Approved</option>
              <option value="">All Statuses</option>
            </select>
          </div>

          <div>
            <label htmlFor="dept-filter" className="block text-xs font-semibold uppercase tracking-widest text-text-3">
              Department
            </label>
            <select
              id="dept-filter"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                loadAppraisals();
              }}
              className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cycle-filter" className="block text-xs font-semibold uppercase tracking-widest text-text-3">
              Appraisal Cycle
            </label>
            <select
              id="cycle-filter"
              value={cycleFilter}
              onChange={(e) => {
                setCycleFilter(e.target.value);
                loadAppraisals();
              }}
              className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
            >
              <option value="">All Cycles</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading appraisals...</span>
          </div>
        </div>
      ) : (
        <>
          {error ? (
            <div className="mb-6 rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
              {error}
            </div>
          ) : null}

          {appraisals.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-sm">
              <Clock className="mx-auto h-8 w-8 text-text-3" />
              <p className="mt-3 text-sm text-text">
                No appraisals found for the selected filters
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {appraisals.map((appraisal) => (
                <Link
                  key={appraisal.id}
                  href={`/super-admin-dashboard/appraisals/${appraisal.id}`}
                  className="block"
                >
                  <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-brand hover:shadow-md">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Faculty Info */}
                      <div>
                        <h3 className="font-semibold text-text">
                          {appraisal.user?.firstName}{" "}
                          {appraisal.user?.lastName}
                        </h3>
                        <p className="text-xs text-text-3">
                          {appraisal.user?.email}
                        </p>
                        <p className="mt-2 text-xs text-text-2">
                          <span className="font-medium">Department:</span>{" "}
                          {appraisal.user?.department?.name || "N/A"}
                        </p>
                        <p className="text-xs text-text-2">
                          <span className="font-medium">Cycle:</span>{" "}
                          {appraisal.cycle?.name}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-col gap-3 sm:items-end">
                        <div className="text-right">
                          <p className="text-xs text-text-3">Final Score</p>
                          <p className="text-xl font-bold text-brand">
                            {appraisal.finalScore?.toFixed(2) ?? 0}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-text-3">
                            Approved Percentage
                          </p>
                          <p className="text-lg font-semibold text-text">
                            {(appraisal.finalPercent ?? 0).toFixed(1)}%
                          </p>
                        </div>

                        {/* Salary Impact */}
                        {appraisal.currentSalary && (
                          <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2">
                            <DollarSign className="h-4 w-4 text-success" />
                            <div className="text-xs">
                              <p className="text-text-3">Salary Increment</p>
                              <p className="font-semibold text-success">
                                ₹
                                {Math.round(
                                  (appraisal.currentSalary *
                                    (appraisal.finalPercent ?? 0)) /
                                    100
                                ).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Status Badge */}
                        <div>
                          {appraisal.status === "SUPER_ADMIN_PENDING" ? (
                            <span className="inline-flex items-center rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">
                              <Clock className="mr-1 h-3 w-3" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-success-bg px-3 py-1 text-xs font-semibold text-success">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Approved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

export default SuperAdminAppraislalsPage;
