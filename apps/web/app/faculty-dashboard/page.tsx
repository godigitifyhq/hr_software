"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, PencilLine, ShieldCheck } from "lucide-react";
import { withAuth } from "@/components/auth/withAuth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";
import type { FacultyProfile } from "@svgoi/shared-types";

function getImageSrc(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return null;
  }

  return imageUrl.startsWith("http") ? imageUrl : `${API_ORIGIN}${imageUrl}`;
}

function FacultyDashboardPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.faculty.getProfile();

        if (active) {
          setProfile(response.data);
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
