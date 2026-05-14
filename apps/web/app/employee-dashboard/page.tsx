"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  User,
} from "lucide-react";
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not provided";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "Invalid date";
  }
}

function EmployeeDashboardContent() {
  const { session } = useAuthStore();
  const router = useRouter();
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

        if (!active) return;

        if (!response.data.isProfileComplete) {
          router.push("/profile?complete=1");
          return;
        }

        setProfile(response.data);
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load employee dashboard",
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
  }, [router]);

  const imageSrc = getImageSrc(profile?.imageUrl);
  const displayName = `${session?.user.firstName ?? ""} ${
    session?.user.lastName ?? ""
  }`.trim();

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3 text-text-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading employee dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="Employee Dashboard"
        subtitle="Welcome to your employee portal. View your profile and stay updated."
      />

      <div className="grid gap-6">
        {/* Top Section: Profile Card & Quick Links */}
        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Profile Card */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-success-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Profile Complete
                </div>
                <h2 className="mt-4 font-display text-3xl font-semibold text-text">
                  {displayName}
                </h2>
                <p className="mt-2 text-sm text-text-2">
                  {session?.user.department?.name || "Department"}
                </p>
              </div>
              {imageSrc ? (
                <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt="Employee profile"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2">
                  <User className="h-8 w-8 text-text-3" />
                </div>
              )}
            </div>

            {/* Profile Action Button */}
            <Link
              href="/profile"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2"
            >
              <FileText className="h-4 w-4" />
              Edit Profile
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-bg p-2">
                  <Calendar className="h-5 w-5 text-blue" />
                </div>
                <div>
                  <p className="text-xs text-text-3">Date of Joining</p>
                  <p className="font-semibold text-text">
                    {formatDate(profile?.dateOfJoining)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-bg p-2">
                  <Clock className="h-5 w-5 text-green" />
                </div>
                <div>
                  <p className="text-xs text-text-3">Total Experience</p>
                  <p className="font-semibold text-text">
                    {profile?.totalExperience ?? 0} Years
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Personal Information */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="font-display text-lg font-semibold text-text">
            Personal Information
          </h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Father's Name */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                Father&apos;s Name
              </p>
              <p className="mt-1 text-sm text-text">
                {profile?.fatherName || "Not provided"}
              </p>
            </div>

            {/* Date of Birth */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                Date of Birth
              </p>
              <p className="mt-1 text-sm text-text">
                {formatDate(profile?.dob)}
              </p>
            </div>

            {/* Department */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                Department
              </p>
              <p className="mt-1 text-sm text-text">
                {session?.user.department?.name || "Not assigned"}
              </p>
            </div>

            {/* PAN */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                PAN
              </p>
              <p className="mt-1 text-sm text-text">
                {profile?.pan
                  ? `${profile.pan.substring(0, 5)}****`
                  : "Not provided"}
              </p>
            </div>

            {/* Aadhaar */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                Aadhaar
              </p>
              <p className="mt-1 text-sm text-text">
                {profile?.aadhar
                  ? `****${profile.aadhar.substring(profile.aadhar.length - 4)}`
                  : "Not provided"}
              </p>
            </div>
          </div>
        </section>

        {/* Professional Information */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="font-display text-lg font-semibold text-text">
            Professional Information
          </h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Current Salary */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                Current Salary
              </p>
              <p className="mt-1 text-sm font-semibold text-text">
                ₹{(profile?.currentSalary ?? 0).toLocaleString("en-IN")}
              </p>
            </div>

            {/* Last Increment Date */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                Last Increment Date
              </p>
              <p className="mt-1 text-sm text-text">
                {formatDate(profile?.lastIncrementDate)}
              </p>
            </div>
          </div>
        </section>

        {/* Educational Background */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="font-display text-lg font-semibold text-text">
            Educational Background
          </h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* 10th Marks */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                10th Marks
              </p>
              <p className="mt-1 text-sm text-text">
                {profile?.tenthMarks
                  ? `${profile.tenthMarks}%`
                  : "Not provided"}
              </p>
            </div>

            {/* 12th Marks */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                12th Marks
              </p>
              <p className="mt-1 text-sm text-text">
                {profile?.twelfthMarks
                  ? `${profile.twelfthMarks}%`
                  : "Not provided"}
              </p>
            </div>

            {/* Qualification */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                Qualification
              </p>
              <p className="mt-1 text-sm text-text">
                {profile?.qualification || "Not provided"}
              </p>
            </div>

            {/* Graduation */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                Graduation
              </p>
              <p className="mt-1 text-sm text-text">
                {profile?.graduation || "Not provided"}
              </p>
            </div>

            {/* Post-Graduation */}
            {profile?.postGraduation && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                  Post Graduation
                </p>
                <p className="mt-1 text-sm text-text">
                  {profile.postGraduation}
                </p>
              </div>
            )}

            {/* PhD */}
            {profile?.phdDegree && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                  PhD Degree
                </p>
                <p className="mt-1 text-sm text-text">{profile.phdDegree}</p>
              </div>
            )}
          </div>
        </section>

        {/* Navigation Links */}
        <section className="grid gap-4 md:grid-cols-2">
          <Link
            href="/appraisals"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-blue hover:bg-blue-bg/20"
          >
            <Award className="h-5 w-5 text-blue" />
            <div>
              <p className="font-semibold text-text">View Appraisals</p>
              <p className="text-xs text-text-2">
                Check your appraisal submissions
              </p>
            </div>
          </Link>

          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-green hover:bg-green-bg/20"
          >
            <FileText className="h-5 w-5 text-green" />
            <div>
              <p className="font-semibold text-text">Update Profile</p>
              <p className="text-xs text-text-2">
                Keep your information current
              </p>
            </div>
          </Link>
        </section>
      </div>
    </AppShell>
  );
}

export default withAuth(EmployeeDashboardContent, ["EMPLOYEE"]);
