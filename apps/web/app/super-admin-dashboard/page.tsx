"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import {
  Users,
  BarChart3,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPrimaryRole } from "@/lib/utils/routing";

interface SystemStats {
  totalUsers: number;
  totalAppraisals: number;
  appraisalsByStatus: Array<{ status: string; _count: number }>;
  roleDistribution: Array<{ role: string; _count: number }>;
}

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
  roles: Array<{ role: string }>;
}

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  meta: string | null;
  createdAt: string;
  actor: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { session, isHydrated } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!session) {
      router.push("/login");
      return;
    }

    const isSuperAdmin = session.user.roles.includes("SUPER_ADMIN");
    if (!isSuperAdmin) {
      router.push("/unauthorized");
      return;
    }

    fetchAdminData();
  }, [isHydrated, session, router]);

  async function fetchAdminData() {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, usersRes, logsRes] = await Promise.all([
        apiClient.get("/admin/statistics"),
        apiClient.get("/admin/users"),
        apiClient.get("/admin/audit-logs"),
      ]);

      setStats(statsRes.data.data);
      setUsers(usersRes.data.data);
      setLogs(logsRes.data.data);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Failed to load admin dashboard";
      console.error("Admin dashboard fetch error:", {
        status: err?.response?.status,
        message,
        data: err?.response?.data,
      });
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-slate-100 text-slate-700",
      SUBMITTED: "bg-blue-100 text-blue-700",
      HOD_REVIEW: "bg-yellow-100 text-yellow-700",
      COMMITTEE_REVIEW: "bg-purple-100 text-purple-700",
      HR_FINALIZED: "bg-orange-100 text-orange-700",
      SUPER_ADMIN_PENDING: "bg-warning-bg text-warning",
      FULLY_APPROVED: "bg-success-bg text-success",
      CLOSED: "bg-gray-100 text-gray-700",
    };
    return colors[status] || "bg-slate-100 text-slate-700";
  };

  if (!isHydrated || loading) {
    return (
      <AppShell role={role}>
        <PageHeader
          title="Super Admin Dashboard"
          subtitle="System overview and user management"
          actions={undefined}
        />
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="rounded-lg border border-border bg-surface px-6 py-5 shadow-sm">
            <div className="flex items-center gap-3 text-text-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading admin dashboard...</span>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell role={role}>
        <PageHeader
          title="Super Admin Dashboard"
          subtitle="System overview and user management"
          actions={undefined}
        />
        <div className="rounded-lg border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{error}</p>
              <button
                onClick={fetchAdminData}
                className="mt-2 text-sm font-medium underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="Super Admin Dashboard"
        subtitle="System overview, user management, and appraisal approvals"
        actions={
          <Link
            href="/super-admin-dashboard/appraisals"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
          >
            View Appraisals
          </Link>
        }
      />

      {/* Appraisal Workflow Section */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/super-admin-dashboard/appraisals"
          className="group rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-warning hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Appraisals Pending
              </p>
              <p className="mt-2 text-2xl font-bold text-warning">
                {stats?.appraisalsByStatus?.find(
                  (s) => s.status === "SUPER_ADMIN_PENDING",
                )?._count ?? 0}
              </p>
              <p className="mt-1 text-xs text-text-2">
                Awaiting super admin approval
              </p>
            </div>
            <Clock className="h-8 w-8 text-warning opacity-50 group-hover:opacity-100" />
          </div>
        </Link>

        <Link
          href="/super-admin-dashboard/appraisals?status=FULLY_APPROVED"
          className="group rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-success hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Fully Approved
              </p>
              <p className="mt-2 text-2xl font-bold text-success">
                {stats?.appraisalsByStatus?.find(
                  (s) => s.status === "FULLY_APPROVED",
                )?._count ?? 0}
              </p>
              <p className="mt-1 text-xs text-text-2">Appraisals completed</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-success opacity-50 group-hover:opacity-100" />
          </div>
        </Link>
      </div>

      {/* System Statistics */}
      {stats && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            {/* Total Users */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Total Users
              </p>
              <p className="mt-2 text-2xl font-bold text-text">
                {stats.totalUsers}
              </p>
            </div>

            {/* Total Appraisals */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Total Appraisals
              </p>
              <p className="mt-2 text-2xl font-bold text-text">
                {stats.totalAppraisals}
              </p>
            </div>

            {/* HR Finalized */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                HR Finalized
              </p>
              <p className="mt-2 text-2xl font-bold text-warning">
                {stats.appraisalsByStatus.find(
                  (s) => s.status === "HR_FINALIZED",
                )?._count || 0}
              </p>
            </div>

            {/* In Progress */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                In Progress
              </p>
              <p className="mt-2 text-2xl font-bold text-text">
                {(stats.appraisalsByStatus.find((s) => s.status === "SUBMITTED")
                  ?._count || 0) +
                  (stats.appraisalsByStatus.find(
                    (s) => s.status === "HOD_REVIEW",
                  )?._count || 0)}
              </p>
            </div>
          </div>

          {/* Appraisal Status Breakdown */}
          <div className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-3 mb-4">
              Appraisals by Status
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {stats.appraisalsByStatus.map((status) => (
                <div
                  key={status.status}
                  className="flex items-center justify-between rounded-lg bg-bg p-3"
                >
                  <span className="text-sm text-text-2">{status.status}</span>
                  <span className="text-lg font-semibold text-text">
                    {status._count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Role Distribution */}
          <div className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-3 mb-4">
              Users by Role
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {stats.roleDistribution.map((role) => (
                <div
                  key={role.role}
                  className="flex items-center justify-between rounded-lg bg-bg p-3"
                >
                  <span className="text-sm text-text-2">{role.role}</span>
                  <span className="text-lg font-semibold text-text">
                    {role._count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Users Table */}
      <div className="mb-6">
        <h2 className="mb-4 text-lg font-semibold text-text">All Users</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full">
            <thead className="border-b border-border bg-bg">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-3">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-3">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-3">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-3">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-text-3"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-border hover:bg-bg/50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-text">
                        {user.firstName} {user.lastName}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-2">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.roles.map((role) => (
                          <span
                            key={role.role}
                            className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand"
                          >
                            {role.role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-2">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Audit Logs */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-text">
          Recent Activity
        </h2>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-text-3 shadow-sm">
              No audit logs found
            </div>
          ) : (
            logs.slice(0, 20).map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm hover:border-brand/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-text">
                      {log.action} - {log.resource}
                    </p>
                    {log.actor && (
                      <p className="mt-1 text-xs text-text-2">
                        By: {log.actor.firstName} {log.actor.lastName} (
                        {log.actor.email})
                      </p>
                    )}
                    {log.resourceId && (
                      <p className="mt-1 text-xs text-text-3">
                        Resource ID: {log.resourceId}
                      </p>
                    )}
                    {log.meta && (
                      <p className="mt-2 text-xs text-text-3 font-mono bg-bg p-2 rounded">
                        {log.meta}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-text-3 whitespace-nowrap ml-4">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
