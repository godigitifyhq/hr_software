"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, FileUp, Loader2, Mail, Shield, User } from "lucide-react";
import {
  facultyProfileSchema,
  type FacultyProfileInput,
} from "@svgoi/zod-schemas";
import type {
  DepartmentSummary,
  FacultyDocumentSummary,
  FacultyProfile,
  FacultyProfilePayload,
} from "@svgoi/shared-types";
import {
  FACULTY_PROFILE_DOCUMENT_UPLOADS,
  type FacultyDocumentUploadConfig,
} from "@svgoi/shared-types";
import { AppShell } from "@/components/layout/AppShell";
import { withAuth } from "@/components/auth/withAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentUploadCard } from "@/components/upload/DocumentUploadCard";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function toDateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function getImageSrc(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith("http")) {
    return imageUrl;
  }

  return `${API_ORIGIN}${imageUrl}`;
}

function toDocumentMap(documents: FacultyDocumentSummary[] | undefined) {
  return (documents ?? []).reduce<Record<string, FacultyDocumentSummary>>(
    (accumulator, document) => {
      if (document.deletedAt) {
        return accumulator;
      }

      accumulator[document.fieldKey] = document;
      return accumulator;
    },
    {},
  );
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Not set";
  }

  return value.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function FacultyProfileSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuthStore();

  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = getPrimaryRole(session?.user.roles ?? []);

  const profilePictureConfig = FACULTY_PROFILE_DOCUMENT_UPLOADS.find(
    (entry) => entry.fieldKey === "profilePicture",
  );

  const documentConfigs = useMemo(
    () =>
      FACULTY_PROFILE_DOCUMENT_UPLOADS.filter(
        (entry) => entry.fieldKey !== "profilePicture",
      ),
    [],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FacultyProfileInput>({
    resolver: zodResolver(facultyProfileSchema),
    defaultValues: {
      fatherName: "",
      dob: "",
      dateOfJoining: "",
      currentSalary: 0,
      lastIncrementDate: "",
      tenthMarks: 0,
      twelfthMarks: 0,
      totalExperience: 0,
      departmentId: "",
    },
  });

  useEffect(() => {
    const canAccessProfile =
      session?.user.roles.includes("FACULTY") ||
      session?.user.roles.includes("EMPLOYEE") ||
      session?.user.roles.includes("HOD") ||
      session?.user.roles.includes("COMMITTEE") ||
      session?.user.roles.includes("HR") ||
      session?.user.roles.includes("MANAGEMENT") ||
      session?.user.roles.includes("ADMIN") ||
      session?.user.roles.includes("SUPER_ADMIN");

    if (session && !canAccessProfile) {
      const current = encodeURIComponent(session.user.roles.join(","));
      router.replace(
        `/unauthorized?reason=profile-role&required=FACULTY,EMPLOYEE,HOD,COMMITTEE,HR,MANAGEMENT,ADMIN,SUPER_ADMIN&current=${current}&path=%2Fprofile`,
      );
    }
  }, [router, session]);

  useEffect(() => {
    let active = true;

    async function loadFacultyProfile() {
      try {
        setLoading(true);
        setError(null);

        const [profileResponse, departmentsResponse] = await Promise.all([
          api.faculty.getProfile(),
          api.departments.list(),
        ]);

        if (!active) {
          return;
        }

        setProfile(profileResponse.data);
        setDepartments(departmentsResponse.data);
        reset({
          fatherName: profileResponse.data.fatherName ?? "",
          dob: toDateInputValue(profileResponse.data.dob),
          dateOfJoining: toDateInputValue(profileResponse.data.dateOfJoining),
          currentSalary: profileResponse.data.currentSalary ?? 0,
          lastIncrementDate: toDateInputValue(
            profileResponse.data.lastIncrementDate,
          ),
          tenthMarks: profileResponse.data.tenthMarks ?? 0,
          twelfthMarks: profileResponse.data.twelfthMarks ?? 0,
          totalExperience: profileResponse.data.totalExperience ?? 0,
          departmentId: profileResponse.data.departmentId ?? "",
        });
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              "Failed to load faculty profile",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFacultyProfile();

    return () => {
      active = false;
    };
  }, [reset]);

  const documentMap = useMemo(
    () => toDocumentMap(profile?.documents),
    [profile?.documents],
  );

  const uploadedRequiredDocumentCount = useMemo(
    () =>
      documentConfigs
        .filter((entry) => entry.required)
        .filter((entry) => Boolean(documentMap[entry.fieldKey])).length,
    [documentConfigs, documentMap],
  );

  const totalRequiredDocumentCount = useMemo(
    () => documentConfigs.filter((entry) => entry.required).length,
    [documentConfigs],
  );

  const profileBanner = useMemo(() => {
    if (searchParams.get("complete") === "1" && !profile?.isProfileComplete) {
      return "Complete your profile before accessing your dashboard.";
    }

    if (profile?.isProfileComplete) {
      return "Your profile is complete and ready.";
    }

    return null;
  }, [profile?.isProfileComplete, searchParams]);

  function mergeUploadedDocument(uploaded: FacultyDocumentSummary) {
    setProfile((current) => {
      if (!current) {
        return current;
      }

      const nextDocuments = (current.documents ?? []).filter(
        (document) =>
          !(
            document.module === uploaded.module &&
            document.fieldKey === uploaded.fieldKey
          ),
      );

      return {
        ...current,
        imageUrl:
          uploaded.fieldKey === "profilePicture"
            ? uploaded.directUrl ?? uploaded.viewUrl ?? current.imageUrl
            : current.imageUrl,
        documents: [...nextDocuments, uploaded],
      };
    });
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profilePictureConfig) {
      return;
    }

    if (!profilePictureConfig.accept.includes(file.type)) {
      setImageUploadError(
        `Only ${profilePictureConfig.accept.join(
          ", ",
        )} files are allowed for profile pictures.`,
      );
      event.target.value = "";
      return;
    }

    if (file.size > profilePictureConfig.maxSizeBytes) {
      setImageUploadError(profilePictureConfig.helperText);
      event.target.value = "";
      return;
    }

    try {
      setImageUploading(true);
      setImageUploadProgress(0);
      setImageUploadError(null);
      setError(null);
      setMessage(null);

      const response = await api.uploads.uploadDocument(
        "faculty-profile",
        "profilePicture",
        file,
        {
          label: profilePictureConfig.label,
          onUploadProgress: (progress) => {
            setImageUploadProgress(progress.progress);
          },
        },
      );

      mergeUploadedDocument(response.data);
      setMessage("Profile image uploaded successfully.");
    } catch (uploadError: any) {
      const uploadMessage =
        uploadError?.response?.data?.message ||
        uploadError?.message ||
        "Failed to upload profile image";
      setImageUploadError(uploadMessage);
      setError(uploadMessage);
    } finally {
      setImageUploading(false);
      setImageUploadProgress(0);
      event.target.value = "";
    }
  };

  const onSubmit = async (values: FacultyProfileInput) => {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const payload: FacultyProfilePayload = {
        ...values,
        postGraduation: values.postGraduation?.trim() || null,
        phdDegree: values.phdDegree?.trim() || null,
      };

      const response = await api.faculty.saveProfile(payload);
      setProfile(response.data);
      setMessage("Faculty profile saved successfully.");
    } catch (saveError: any) {
      setError(
        saveError?.response?.data?.message ||
          saveError?.message ||
          "Failed to save faculty profile",
      );
    } finally {
      setSaving(false);
    }
  };

  const displayName = `${session?.user.firstName ?? ""} ${
    session?.user.lastName ?? ""
  }`.trim();

  const imageSrc = getImageSrc(
    profile?.imageUrl ??
      documentMap.profilePicture?.directUrl ??
      documentMap.profilePicture?.viewUrl,
  );

  if (loading) {
    return (
      <AppShell role={role}>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading faculty profile...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="Faculty Profile"
        subtitle="Keep your personal details updated and upload the required identity and academic documents."
      />

      <div className="space-y-6">
        {profileBanner ? (
          <div
            className={`rounded-2xl border p-4 text-sm ${
              profile?.isProfileComplete
                ? "border-success/20 bg-success-bg text-success"
                : "border-amber-300/40 bg-amber-50 text-amber-900"
            }`}
          >
            {profileBanner}
            <div className="mt-2 text-xs opacity-80">
              Uploaded required documents: {uploadedRequiredDocumentCount} /{" "}
              {totalRequiredDocumentCount}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-success/20 bg-success-bg p-4 text-sm text-success">
            {message}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-light p-3 text-brand">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-3">
                  Profile owner
                </p>
                <h2 className="font-display text-2xl font-semibold text-text">
                  {displayName || "Faculty user"}
                </h2>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-bg">
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt="Faculty profile"
                  className="h-72 w-full object-cover"
                />
              ) : (
                <div className="flex h-72 items-center justify-center text-text-3">
                  No image uploaded
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-bg p-4">
              <p className="text-sm font-medium text-text">Profile picture</p>
              <p className="mt-1 text-sm text-text-2">
                {profilePictureConfig?.helperText ?? "Upload a profile photo."}
              </p>

              <label
                className={`mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2 ${
                  imageUploading
                    ? "pointer-events-none cursor-not-allowed opacity-70"
                    : "cursor-pointer"
                }`}
              >
                {imageUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {imageUploading ? "Uploading..." : "Upload image"}
                <input
                  type="file"
                  accept={profilePictureConfig?.accept.join(",")}
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>

              {imageUploading ? (
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-text-2">
                    <span>Uploading</span>
                    <span>{imageUploadProgress}%</span>
                  </div>
                  <progress
                    className="h-2 w-full overflow-hidden rounded-full bg-surface-2 [appearance:none] [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-surface-2 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-brand"
                    value={imageUploadProgress}
                    max={100}
                  />
                </div>
              ) : null}

              {imageUploadError ? (
                <p className="mt-3 rounded-xl border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
                  {imageUploadError}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 text-sm text-text-2">
                <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                  <Shield className="h-4 w-4 text-brand" />
                  Stored in Google Drive and linked to your profile record.
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                  <Mail className="h-4 w-4 text-brand" />
                  Use the document section below for PAN, Aadhaar, and degree
                  uploads.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-text">
                    Profile details
                  </h3>
                  <p className="mt-1 text-sm text-text-2">
                    Update the metadata that still belongs in the profile form.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-light px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                  <FileUp className="h-3.5 w-3.5" />
                  Upload driven
                </div>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="mt-6 grid gap-4 md:grid-cols-2"
              >
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Father&apos;s Name
                  </label>
                  <input
                    {...register("fatherName")}
                    className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text"
                  />
                  {errors.fatherName ? (
                    <p className="mt-1 text-xs text-danger">
                      {errors.fatherName.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    {...register("dob")}
                    className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text"
                  />
                  {errors.dob ? (
                    <p className="mt-1 text-xs text-danger">
                      {errors.dob.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Date of Joining
                  </label>
                  <input
                    type="date"
                    {...register("dateOfJoining")}
                    className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text"
                  />
                  {errors.dateOfJoining ? (
                    <p className="mt-1 text-xs text-danger">
                      {errors.dateOfJoining.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Department
                  </label>
                  <select
                    {...register("departmentId")}
                    className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text"
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                  {errors.departmentId ? (
                    <p className="mt-1 text-xs text-danger">
                      {errors.departmentId.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Current Salary
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("currentSalary", { valueAsNumber: true })}
                    className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text"
                  />
                  {errors.currentSalary ? (
                    <p className="mt-1 text-xs text-danger">
                      {errors.currentSalary.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Last Increment Date
                  </label>
                  <input
                    type="date"
                    {...register("lastIncrementDate")}
                    className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text"
                  />
                  {errors.lastIncrementDate ? (
                    <p className="mt-1 text-xs text-danger">
                      {errors.lastIncrementDate.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Total Experience
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...register("totalExperience", { valueAsNumber: true })}
                    className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text"
                  />
                  {errors.totalExperience ? (
                    <p className="mt-1 text-xs text-danger">
                      {errors.totalExperience.message}
                    </p>
                  ) : null}
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-text">
                    Required documents
                  </h3>
                  <p className="mt-1 text-sm text-text-2">
                    Upload PAN, Aadhaar, marksheets, and degrees. Optional
                    postgraduate and PhD documents are supported too.
                  </p>
                </div>
                <div className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-2">
                  {uploadedRequiredDocumentCount} / {totalRequiredDocumentCount}{" "}
                  complete
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {documentConfigs.map((config: FacultyDocumentUploadConfig) => (
                  <DocumentUploadCard
                    key={config.fieldKey}
                    config={config}
                    document={documentMap[config.fieldKey]}
                    disabled={saving || imageUploading}
                    onUpload={(file, onProgress) =>
                      api.uploads
                        .uploadDocument(
                          "faculty-profile",
                          config.fieldKey,
                          file,
                          {
                            label: config.label,
                            onUploadProgress: onProgress,
                          },
                        )
                        .then((response) => response.data)
                    }
                    onUploaded={mergeUploadedDocument}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/80 bg-gradient-to-br from-surface via-surface to-brand-light/20 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-display text-lg font-semibold text-text">
                  Snapshot
                </h4>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-2">
                  Profile quick stats
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                    Department
                  </p>
                  <p className="mt-2 text-sm text-text">
                    {profile?.department?.name ?? "Not set"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                    Current Salary
                  </p>
                  <p className="mt-2 text-sm text-text">
                    {formatCurrency(profile?.currentSalary)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                    Total Experience
                  </p>
                  <p className="mt-2 text-sm text-text">
                    {typeof profile?.totalExperience === "number"
                      ? `${profile.totalExperience} years`
                      : "Not set"}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default withAuth(FacultyProfileSection, [
  "FACULTY",
  "EMPLOYEE",
  "HOD",
  "COMMITTEE",
  "HR",
  "MANAGEMENT",
  "ADMIN",
  "SUPER_ADMIN",
]);
