"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth";
import { formatDate } from "@/lib/date-utils";
import {
  Users,
  BarChart3,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";

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
      HR_FINALIZED: "bg-green-100 text-green-700",
      CLOSED: "bg-gray-100 text-gray-700",
    };
    return colors[status] || "bg-slate-100 text-slate-700";
  };

  if (!isHydrated || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <h1 className="text-lg font-semibold text-slate-900">
              Super Admin Dashboard
            </h1>
          </div>
        </header>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="rounded-lg border border-border bg-surface px-6 py-5 shadow-sm">
            <div className="flex items-center gap-3 text-text-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading admin dashboard...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              ← Back
            </Link>
            <h1 className="text-lg font-semibold text-slate-900">
              Super Admin Dashboard
            </h1>
            <div className="w-20" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
                <button
                  onClick={fetchAdminData}
                  className="mt-2 text-sm font-medium text-red-700 hover:text-red-900 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
            title="Back to dashboard"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">
            Super Admin Dashboard
          </h1>
          <div className="w-20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* System Statistics */}
        {stats && (
          <div className="mb-12">
            <h2 className="mb-6 text-lg font-semibold text-slate-900">
              System Overview
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Users */}
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Users</p>
                    <p className="mt-1 text-3xl font-semibold text-slate-900">
                      {stats.totalUsers}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Total Appraisals */}
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Appraisals</p>
                    <p className="mt-1 text-3xl font-semibold text-slate-900">
                      {stats.totalAppraisals}
                    </p>
                  </div>
                  <div className="rounded-lg bg-purple-100 p-3 text-purple-600">
                    <FileText className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Finalized */}
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Finalized</p>
                    <p className="mt-1 text-3xl font-semibold text-slate-900">
                      {stats.appraisalsByStatus.find(
                        (s) => s.status === "HR_FINALIZED"
                      )?._count || 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-green-100 p-3 text-green-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* In Progress */}
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">In Progress</p>
                    <p className="mt-1 text-3xl font-semibold text-slate-900">
                      {(stats.appraisalsByStatus.find(
                        (s) => s.status === "SUBMITTED"
                      )?._count || 0) +
                        (stats.appraisalsByStatus.find(
                          (s) => s.status === "HOD_REVIEW"
                        )?._count || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-yellow-100 p-3 text-yellow-600">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </div>

            {/* Appraisal Status Breakdown */}
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                Appraisals by Status
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stats.appraisalsByStatus.map((status) => (
                  <div
                    key={status.status}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <span className="text-sm text-slate-600">
                      {status.status}
                    </span>
                    <span className="text-lg font-semibold text-slate-900">
                      {status._count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Role Distribution */}
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                Users by Role
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stats.roleDistribution.map((role) => (
                  <div
                    key={role.role}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <span className="text-sm text-slate-600">{role.role}</span>
                    <span className="text-lg font-semibold text-slate-900">
                      {role._count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="mb-12">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">
            All Users
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Roles
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-t border-slate-200 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-slate-200 p-2 text-slate-600">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {user.firstName} {user.lastName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((role) => (
                            <span
                              key={role.role}
                              className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                            >
                              {role.role}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(user.createdAt)}
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
          <h2 className="mb-6 text-lg font-semibold text-slate-900">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                No audit logs found
              </div>
            ) : (
              logs.slice(0, 20).map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {log.action} - {log.resource}
                      </p>
                      {log.actor && (
                        <p className="mt-1 text-sm text-slate-600">
                          By: {log.actor.firstName} {log.actor.lastName} (
                          {log.actor.email})
                        </p>
                      )}
                      {log.resourceId && (
                        <p className="mt-1 text-xs text-slate-500">
                          Resource ID: {log.resourceId}
                        </p>
                      )}
                      {log.meta && (
                        <p className="mt-2 text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded">
                          {log.meta}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 whitespace-nowrap ml-4">
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
