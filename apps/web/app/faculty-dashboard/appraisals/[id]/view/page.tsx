"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, type FacultyAppraisalDetail } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

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

function ViewSubmittedAppraisalPage() {
  const params = useParams();
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const appraisalId = params.id as string;

  const [appraisal, setAppraisal] = useState<FacultyAppraisalDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAppraisal() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.faculty.getAppraisalDetails(appraisalId);

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
        subtitle={`Appraisal ID: ${appraisal.id}`}
        actions={
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        }
      />

      <div className="grid gap-6">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
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
                {appraisal.submittedAt ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Final Score
              </p>
              <p className="mt-2 text-sm font-medium text-text">
                {appraisal.finalScore ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Final Percent
              </p>
              <p className="mt-2 text-sm font-medium text-text">
                {appraisal.finalPercent ?? "-"}%
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {appraisal.items.map((item) => (
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
      </div>
    </AppShell>
  );
}

export default withAuth(ViewSubmittedAppraisalPage, ["FACULTY", "EMPLOYEE"]);
