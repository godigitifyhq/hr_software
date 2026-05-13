"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2, LogOut, Mail, Shield, User } from "lucide-react";
import { facultyProfileSchema, type FacultyProfileInput } from "@svgoi/zod-schemas";
import type {
  DepartmentSummary,
  FacultyProfile,
  FacultyProfilePayload,
} from "@svgoi/shared-types";
import { AppShell } from "@/components/layout/AppShell";
import { withAuth } from "@/components/auth/withAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { userHasFacultyOrEmployeeRole } from "@/lib/faculty-access";
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

function FacultyProfileSection() {
  const { session } = useAuthStore();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      pan: "",
      aadhar: "",
      tenthMarks: 0,
      twelfthMarks: 0,
      qualification: "",
      graduation: "",
      postGraduation: "",
      phdDegree: "",
      totalExperience: 0,
      departmentId: "",
    },
  });

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
          lastIncrementDate: toDateInputValue(profileResponse.data.lastIncrementDate),
          pan: profileResponse.data.pan ?? "",
          aadhar: profileResponse.data.aadhar ?? "",
          tenthMarks: profileResponse.data.tenthMarks ?? 0,
          twelfthMarks: profileResponse.data.twelfthMarks ?? 0,
          qualification: profileResponse.data.qualification ?? "",
          graduation: profileResponse.data.graduation ?? "",
          postGraduation: profileResponse.data.postGraduation ?? "",
          phdDegree: profileResponse.data.phdDegree ?? "",
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

  const profileBanner = useMemo(() => {
    if (searchParams.get("complete") === "1" && !profile?.isProfileComplete) {
      return "Complete your profile before accessing your dashboard.";
    }

    if (profile?.isProfileComplete) {
      return "Your profile is complete and ready.";
    }

    return null;
  }, [profile?.isProfileComplete, searchParams]);

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

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setUploadingImage(true);
      setError(null);
      setMessage(null);
      const response = await api.faculty.uploadImage(file);
      setProfile(response.data);
      setMessage("Profile image uploaded successfully.");
    } catch (uploadError: any) {
      setError(
        uploadError?.response?.data?.message ||
          uploadError?.message ||
          "Failed to upload profile image",
      );
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const displayName = `${session?.user.firstName ?? ""} ${
    session?.user.lastName ?? ""
  }`.trim();

  const imageSrc = getImageSrc(profile?.imageUrl);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3 text-text-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading faculty profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {profileBanner ? (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            profile?.isProfileComplete
              ? "border-success/20 bg-success-bg text-success"
              : "border-warning/20 bg-amber-50 text-amber-700"
          }`}
        >
          {profileBanner}
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

      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="overflow-hidden rounded-2xl border border-border bg-bg">
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt="Faculty profile"
                className="h-64 w-full object-cover"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-text-3">
                No image uploaded
              </div>
            )}
          </div>

          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2">
            {uploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {uploadingImage ? "Uploading..." : "Upload image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>
          <p className="mt-2 text-xs text-text-3">
            JPEG, PNG, or WebP up to 4MB.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Name
              </label>
              <input
                value={displayName}
                disabled
                className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Father&apos;s Name
              </label>
              <input
                {...register("fatherName")}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
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
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
              {errors.dob ? (
                <p className="mt-1 text-xs text-danger">{errors.dob.message}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Date of Joining
              </label>
              <input
                type="date"
                {...register("dateOfJoining")}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
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
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
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
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
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
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
              {errors.lastIncrementDate ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.lastIncrementDate.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                PAN
              </label>
              <input
                {...register("pan")}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
              {errors.pan ? (
                <p className="mt-1 text-xs text-danger">{errors.pan.message}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Aadhaar
              </label>
              <input
                {...register("aadhar")}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
              {errors.aadhar ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.aadhar.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                10th Marks
              </label>
              <input
                type="number"
                step="0.01"
                {...register("tenthMarks", { valueAsNumber: true })}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
              {errors.tenthMarks ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.tenthMarks.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                12th Marks
              </label>
              <input
                type="number"
                step="0.01"
                {...register("twelfthMarks", { valueAsNumber: true })}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
              {errors.twelfthMarks ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.twelfthMarks.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Qualification
              </label>
              <input
                {...register("qualification")}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
              {errors.qualification ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.qualification.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Graduation
              </label>
              <input
                {...register("graduation")}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
              {errors.graduation ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.graduation.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Post Graduation
              </label>
              <input
                {...register("postGraduation")}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                PhD Degree
              </label>
              <input
                {...register("phdDegree")}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-text">
                Total Experience
              </label>
              <input
                type="number"
                step="0.1"
                {...register("totalExperience", { valueAsNumber: true })}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
              />
              {errors.totalExperience ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.totalExperience.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function GenericProfileSection() {
  const router = useRouter();
  const { session, logout } = useAuthStore();

  if (!session) {
    return null;
  }

  const displayName = `${session.user.firstName} ${session.user.lastName}`;
  const role = getPrimaryRole(session.user.roles);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network failures and clear local state.
    } finally {
      logout();
      router.push("/login");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light text-brand">
          <User className="h-8 w-8" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold text-text">
          {displayName}
        </h2>
        <p className="mt-1 text-sm text-text-2">{role}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-danger transition hover:bg-danger-bg"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-bg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-text-2">
              <Mail className="h-4 w-4 text-brand" />
              Email
            </div>
            <p className="mt-2 text-sm text-text">{session.user.email}</p>
          </div>
          <div className="rounded-xl bg-bg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-text-2">
              <Shield className="h-4 w-4 text-brand" />
              Roles
            </div>
            <p className="mt-2 text-sm text-text">
              {session.user.roles.join(", ")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProfilePage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const isFacultyOrEmployee = userHasFacultyOrEmployeeRole(session?.user.roles ?? []);
  const isHod = (session?.user.roles ?? []).includes("HOD");

  return (
    <AppShell role={role}>
      <PageHeader
        title={isFacultyOrEmployee ? "Employee Profile" : "My Profile"}
        subtitle={
          isFacultyOrEmployee
            ? isHod
              ? "Complete and maintain your HOD profile details."
              : "Complete and maintain your employee profile details."
            : "Review your account details and active role."
        }
      />

      {isFacultyOrEmployee ? <FacultyProfileSection /> : <GenericProfileSection />}
    </AppShell>
  );
}

export default withAuth(ProfilePage);
