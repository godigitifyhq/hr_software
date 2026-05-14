"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";
import type {
  FacultyAppraisalRequestStatus,
  FacultyProfile,
} from "@svgoi/shared-types";

function getImageSrc(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return null;
  }
  const toDriveProxy = (url: string) => {
    try {
      const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const q = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      const fileId = m?.[1] ?? q?.[1];
      if (!fileId) return url;

      if (typeof window !== "undefined") {
        try {
          const apiOrigin = new URL(API_ORIGIN).origin;
          if (apiOrigin !== window.location.origin) {
            return `${API_ORIGIN}/api/v1/drive/${fileId}`;
          }
        } catch {
          // fall through to return original url
        }
      }

      return `${API_ORIGIN}/api/v1/drive/${fileId}`;
    } catch (e) {
      return url;
    }
  };

  const toDriveDirect = (url: string) => {
    try {
      if (
        url.includes("drive.google.com/uc") ||
        url.includes("lh3.googleusercontent.com")
      ) {
        const q = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (q && q[1]) {
          const direct = `https://drive.google.com/uc?export=view&id=${q[1]}`;
          return toDriveProxy(direct);
        }
        const normalized = url.replace("export=download", "export=view");
        return toDriveProxy(normalized);
      }

      const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) {
        return toDriveProxy(
          `https://drive.google.com/uc?export=view&id=${m[1]}`,
        );
      }
      const q2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (q2 && q2[1]) {
        return toDriveProxy(
          `https://drive.google.com/uc?export=view&id=${q2[1]}`,
        );
      }
      return url;
    } catch (e) {
      return url;
    }
  };

  return imageUrl.startsWith("http")
    ? toDriveDirect(imageUrl)
    : `${API_ORIGIN}${imageUrl}`;
}

function FacultyDashboardPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [requestStatus, setRequestStatus] =
    useState<FacultyAppraisalRequestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);
        const [profileResponse, statusResponse] = await Promise.all([
          api.faculty.getProfile(),
          api.faculty.getAppraisalStatus(),
        ]);

        if (active) {
          setProfile(profileResponse.data);
          setRequestStatus(statusResponse.data);
        }
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load faculty dashboard",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const imageSrc = getImageSrc(profile?.imageUrl);

  return (
    <AppShell role={role}>
      <PageHeader
        title="Faculty Dashboard"
        subtitle="Your onboarding details are complete and ready for review."
      />

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading faculty dashboard...</span>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-success-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-success">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Profile Complete
                </div>
                <h2 className="mt-4 font-display text-3xl font-semibold text-text">
                  {session?.user.firstName} {session?.user.lastName}
                </h2>
                <p className="mt-2 text-sm text-text-2">
                  Welcome to your faculty dashboard. Your onboarding profile is
                  complete, and you can update it anytime if something changes.
                </p>
              </div>

              <div className="rounded-2xl bg-brand-light p-3 text-brand">
                <GraduationCap className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/profile"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
              >
                <PencilLine className="h-4 w-4" />
                Edit Profile
              </Link>
              {requestStatus?.hasRequest ? (
                <div className="flex gap-2">
                  <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-success/20 bg-success-bg px-4 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Appraisal Requested
                  </div>
                  <Link
                    href={`/faculty-dashboard/appraisals/${requestStatus.appraisalId}/view`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
                  >
                    View Form
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <Link
                  href="/faculty-dashboard/request-appraisal"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
                >
                  Request Appraisal
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="overflow-hidden rounded-2xl border border-border bg-bg">
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt="Faculty profile"
                  className="h-72 w-full object-cover"
                />
              ) : (
                <div className="flex h-72 items-center justify-center text-text-3">
                  Profile image not uploaded
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm lg:col-span-2">
            <h3 className="font-display text-xl font-semibold text-text">
              Profile Summary
            </h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl bg-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Department
                </p>
                <p className="mt-2 text-sm text-text">
                  {profile?.department?.name ?? "Not set"}
                </p>
              </div>
              <div className="rounded-xl bg-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Qualification
                </p>
                <p className="mt-2 text-sm text-text">
                  {profile?.qualification ?? "Not set"}
                </p>
              </div>
              <div className="rounded-xl bg-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Graduation
                </p>
                <p className="mt-2 text-sm text-text">
                  {profile?.graduation ?? "Not set"}
                </p>
              </div>
              <div className="rounded-xl bg-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Current Salary
                </p>
                <p className="mt-2 text-sm text-text">
                  {typeof profile?.currentSalary === "number"
                    ? profile.currentSalary.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      })
                    : "Not set"}
                </p>
              </div>
              <div className="rounded-xl bg-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Total Experience
                </p>
                <p className="mt-2 text-sm text-text">
                  {typeof profile?.totalExperience === "number"
                    ? `${profile.totalExperience} years`
                    : "Not set"}
                </p>
              </div>
              <div className="rounded-xl bg-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Last Increment Date
                </p>
                <p className="mt-2 text-sm text-text">
                  {profile?.lastIncrementDate
                    ? new Date(profile.lastIncrementDate).toLocaleDateString()
                    : "Not set"}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

export default withAuth(FacultyDashboardPage, ["FACULTY"]);
