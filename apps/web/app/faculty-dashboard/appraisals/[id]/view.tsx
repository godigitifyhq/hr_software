"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  AlertCircle,
  Download,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

interface AppraisalItem {
  id: string;
  criterionKey: string;
  heading: string;
  selectedValue: string;
  selectedLabel: string;
  facultyPoints: number;
  hodApprovedPoints: number;
  hodRemark: string;
  committeeApprovedPoints: number;
  committeeRemark: string;
  evidence: Array<{
    criterionKey: string;
    fileName: string;
    mime: string;
    size: number;
    url: string;
  }>;
}

interface AppraisalDetail {
  id: string;
  status: string;
  submittedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    departmentId: string;
    department: { id: string; name: string };
  };
  cycle: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  items: AppraisalItem[];
  finalScore: number | null;
  finalPercent: number | null;
  hodRemarks: Record<string, any>;
  committeeNotes: Record<string, any>;
}

function ViewSubmittedAppraisalPage() {
  const params = useParams();
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const appraisalId = params.id as string;

  const [appraisal, setAppraisal] = useState<AppraisalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<
    "All" | "Academics" | "Research" | "Others"
  >("All");

  useEffect(() => {
    let active = true;

    async function loadAppraisal() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.appraisals.getById(appraisalId);

        if (active) {
          setAppraisal(response.data);
        }
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load appraisal",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAppraisal();

    return () => {
      active = false;
    };
  }, [appraisalId]);

  const getCategoryColor = (
    category?: string,
  ):
    | "bg-blue-100 text-blue-800"
    | "bg-purple-100 text-purple-800"
    | "bg-green-100 text-green-800" => {
    switch (category) {
      case "Academics":
        return "bg-blue-100 text-blue-800";
      case "Research":
        return "bg-purple-100 text-purple-800";
      case "Others":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (loading) {
    return (
      <AppShell role={role}>
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-6">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
          <span className="text-sm text-text-2">Loading appraisal...</span>
        </div>
      </AppShell>
    );
  }

  if (error || !appraisal) {
    return (
      <AppShell role={role}>
        <div className="rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>{error || "Appraisal not found"}</div>
          </div>
        </div>
      </AppShell>
    );
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<
      string,
      { bg: string; text: string; icon: React.ReactNode }
    > = {
      DRAFT: {
        bg: "bg-gray-100",
        text: "text-gray-800",
        icon: <FileText className="h-4 w-4" />,
      },
      HOD_REVIEW: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        icon: <AlertCircle className="h-4 w-4" />,
      },
      COMMITTEE_REVIEW: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        icon: <AlertCircle className="h-4 w-4" />,
      },
      HR_FINALIZED: {
        bg: "bg-green-100",
        text: "text-green-800",
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      CLOSED: {
        bg: "bg-green-100",
        text: "text-green-800",
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
    };

    const badge = badges[status] || badges.DRAFT;
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full ${badge.bg} ${badge.text} px-3 py-1 text-xs font-semibold uppercase tracking-wider`}
      >
        {badge.icon}
        {status.replace(/_/g, " ")}
      </div>
    );
  };

  const filteredItems =
    filterCategory === "All"
      ? appraisal.items
      : appraisal.items.filter((item) => {
          // Items don't have category, so we need to infer it from heading or key
          // For now, show all items in "All" category
          return true;
        });

  return (
    <AppShell role={role}>
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/faculty-dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-dark"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <PageHeader
        title="View Submitted Appraisal"
        subtitle={`Appraisal for ${appraisal.cycle.name}`}
      />

      <div className="grid gap-6">
        {/* Header Info */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Faculty Name
              </p>
              <p className="mt-2 text-sm font-medium text-text">
                {appraisal.user.firstName} {appraisal.user.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Department
              </p>
              <p className="mt-2 text-sm font-medium text-text">
                {appraisal.user.department.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Status
              </p>
              <div className="mt-2">{getStatusBadge(appraisal.status)}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Submitted On
              </p>
              <p className="mt-2 text-sm font-medium text-text">
                {appraisal.submittedAt
                  ? new Date(appraisal.submittedAt).toLocaleDateString()
                  : "Not submitted"}
              </p>
            </div>
          </div>
        </div>

        {/* Criteria Items */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="font-display text-xl font-semibold text-text mb-4">
            Appraisal Criteria
          </h3>

          <div className="space-y-4">
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-bg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-text-3 bg-surface rounded px-2 py-1">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-medium text-text">
                          {item.heading}
                        </h4>
                        <p className="mt-1 text-sm text-text-2">
                          Selected:{" "}
                          <span className="font-medium">
                            {item.selectedLabel}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Points Breakdown */}
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded bg-blue-50 p-3">
                        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
                          Faculty Points
                        </p>
                        <p className="mt-1 text-lg font-bold text-blue-900">
                          {item.facultyPoints}
                        </p>
                      </div>

                      {item.hodApprovedPoints !== item.facultyPoints && (
                        <div className="rounded bg-orange-50 p-3">
                          <p className="text-xs font-semibold text-orange-800 uppercase tracking-wider">
                            HOD Deduction
                          </p>
                          <p className="mt-1 text-lg font-bold text-orange-900">
                            {item.hodApprovedPoints}
                          </p>
                          {item.hodRemark && (
                            <p className="mt-2 text-xs text-orange-700">
                              <span className="font-semibold">Remark:</span>{" "}
                              {item.hodRemark}
                            </p>
                          )}
                        </div>
                      )}

                      {item.committeeApprovedPoints !==
                        item.hodApprovedPoints && (
                        <div className="rounded bg-purple-50 p-3">
                          <p className="text-xs font-semibold text-purple-800 uppercase tracking-wider">
                            Committee Deduction
                          </p>
                          <p className="mt-1 text-lg font-bold text-purple-900">
                            {item.committeeApprovedPoints}
                          </p>
                          {item.committeeRemark && (
                            <p className="mt-2 text-xs text-purple-700">
                              <span className="font-semibold">Remark:</span>{" "}
                              {item.committeeRemark}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Evidence Files */}
                    {item.evidence && item.evidence.length > 0 && (
                      <div className="mt-4 rounded bg-green-50 p-3">
                        <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">
                          Evidence Files ({item.evidence.length})
                        </p>
                        <ul className="mt-2 space-y-1">
                          {item.evidence.map((file, fileIndex) => (
                            <li
                              key={fileIndex}
                              className="flex items-center gap-2 text-xs"
                            >
                              <Download className="h-3 w-3 text-green-700" />
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-700 hover:underline"
                              >
                                {file.fileName} ({formatFileSize(file.size)})
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        {appraisal.finalScore !== null && (
          <div className="rounded-2xl border border-success/20 bg-success-bg p-6 shadow-sm">
            <h3 className="font-display text-xl font-semibold text-success mb-4">
              Final Score
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-success-dark">
                  Total Points
                </p>
                <p className="mt-2 text-3xl font-bold text-success">
                  {appraisal.finalScore}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-success-dark">
                  Increment Percentage
                </p>
                <p className="mt-2 text-3xl font-bold text-success">
                  {appraisal.finalPercent}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* HOD Remarks */}
        {Object.keys(appraisal.hodRemarks).length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="font-display text-lg font-semibold text-text mb-3">
              HOD Remarks
            </h3>
            {appraisal.hodRemarks.overallRemark && (
              <p className="text-sm text-text">
                {appraisal.hodRemarks.overallRemark}
              </p>
            )}
            {appraisal.hodRemarks.additionalPoints > 0 && (
              <div className="mt-3 rounded bg-bg p-3">
                <p className="text-xs font-semibold text-text-3">
                  Additional Points: {appraisal.hodRemarks.additionalPoints}
                </p>
                {appraisal.hodRemarks.additionalPointsRemark && (
                  <p className="mt-1 text-sm text-text">
                    {appraisal.hodRemarks.additionalPointsRemark}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Committee Notes */}
        {Object.keys(appraisal.committeeNotes).length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="font-display text-lg font-semibold text-text mb-3">
              Committee Review Notes
            </h3>
            {appraisal.committeeNotes.overallRemark && (
              <p className="text-sm text-text">
                {appraisal.committeeNotes.overallRemark}
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default withAuth(ViewSubmittedAppraisalPage, ["FACULTY", "EMPLOYEE"]);
