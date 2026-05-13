"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth";
import { formatDate } from "@/lib/date-utils";

interface AppraisalItem {
  id: string;
  status: string;
  cycle: { name: string };
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    department?: { name: string };
  };
  submittedAt?: string;
  finalScore?: number;
  finalPercent?: number;
  createdAt: string;
}

interface DashboardData {
  all: AppraisalItem[];
  byStatus: Record<string, AppraisalItem[]>;
}

export default function HrDashboardPage() {
  const router = useRouter();
  const { session, isHydrated } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { session, isHydrated } = useAuthStore.getState();

    if (!isHydrated) {
      const unsubscribe = useAuthStore.subscribe((state) => {
        if (state.isHydrated) {
          if (!state.session) {
            router.push("/login");
          } else {
            checkAccessAndFetch();
          }
          unsubscribe();
        }
      });
      return;
    }

    if (!session) {
      router.push("/login");
      return;
    }

    checkAccessAndFetch();
  }, [router]);

  async function checkAccessAndFetch() {
    // Check if user has an HR-access role.
    const allowedRoles = ["HR", "SUPER_ADMIN"];
    const hasAccess = allowedRoles.some((role) =>
      session?.user.roles.includes(role),
    );
    if (!hasAccess) {
      setError("Access denied. Only HR staff or super admins can view this page.");
      setLoading(false);
      return;
    }
    fetchData();
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await apiClient.get("/appraisals/hr/dashboard");
      setData(data.data);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Failed to load dashboard";
      console.error("HR dashboard fetch error:", {
        status: err?.response?.status,
        message,
        data: err?.response?.data,
      });
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draft", color: "bg-slate-100 text-slate-700" },
    SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-700" },
    HOD_REVIEW: { label: "HOD Review", color: "bg-yellow-100 text-yellow-700" },
    COMMITTEE_REVIEW: {
      label: "Committee Review",
      color: "bg-purple-100 text-purple-700",
    },
    HR_FINALIZED: { label: "Finalized", color: "bg-green-100 text-green-700" },
    CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-700" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
              <p className="text-sm text-slate-600">Loading dashboard…</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-medium text-red-800">
              {error || "Failed to load dashboard"}
            </p>
            <button
              onClick={fetchData}
              className="mt-4 rounded-full bg-red-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
            >
              Try Again
            </button>
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
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              HR Dashboard
            </h1>
          </div>
          <button
            onClick={fetchData}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Summary Stats */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-600">
              Total Appraisals
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {data.all.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-600">Pending Review</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {(data.byStatus["SUBMITTED"]?.length || 0) +
                (data.byStatus["HOD_REVIEW"]?.length || 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-600">Finalized</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {data.byStatus["HR_FINALIZED"]?.length || 0}
            </p>
          </div>
        </div>

        {/* Appraisals by Status */}
        <div className="space-y-8">
          {Object.entries(data.byStatus).map(([status, appraisals]) => {
            if (appraisals.length === 0) return null;
            const config = statusConfig[status as keyof typeof statusConfig];

            return (
              <div key={status}>
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${config?.color}`}
                  >
                    {config?.label || status}
                  </span>
                  <span className="text-slate-600">({appraisals.length})</span>
                </h2>
                <div className="space-y-2">
                  {appraisals.map((appraisal) => (
                    <Link
                      key={appraisal.id}
                      href={`/appraisals/${appraisal.id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900">
                            {appraisal.user.firstName} {appraisal.user.lastName}
                          </h3>
                          <p className="text-xs text-slate-600">
                            {appraisal.user.email}
                          </p>
                          <p className="text-xs text-slate-500">
                            {appraisal.user.department?.name || "N/A"} •{" "}
                            {appraisal.cycle.name}
                          </p>
                        </div>
                        {appraisal.finalScore !== undefined &&
                          appraisal.finalScore !== null && (
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">
                                {appraisal.finalScore.toFixed(2)}
                              </p>
                              {appraisal.finalPercent !== undefined && (
                                <p className="text-xs text-slate-600">
                                  {appraisal.finalPercent.toFixed(1)}%
                                </p>
                              )}
                            </div>
                          )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
