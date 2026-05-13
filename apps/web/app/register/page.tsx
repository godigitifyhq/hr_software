"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@svgoi/zod-schemas";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

type DepartmentOption = { id: string; name: string };

export default function RegisterPage() {
  const router = useRouter();
  const { session, isHydrated } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      departmentId: "",
    },
  });

  useEffect(() => {
    if (isHydrated && session) {
      router.replace("/");
    }
  }, [isHydrated, router, session]);

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      try {
        const response = await fetch(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
          }/departments`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error("Departments unavailable");
        }

        const payload = await response.json();
        const list = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
          ? payload
          : [];

        if (active) {
          setDepartments(
            list
              .map((item: { id?: string; name?: string }) => ({
                id: item.id ?? "",
                name: item.name ?? "",
              }))
              .filter((item: DepartmentOption) => item.id && item.name),
          );
        }
      } catch {
        if (active) {
          setDepartments([]);
        }
      } finally {
        if (active) {
          setLoadingDepartments(false);
        }
      }
    }

    loadDepartments();

    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (values: RegisterInput) => {
    setServerError(null);

    try {
      await api.auth.register(values);
      router.push("/login?created=1");
    } catch {
      setServerError(
        "Unable to create your account. Please verify the details and try again.",
      );
    }
  };

  const disabled = isSubmitting;
  const submitLabel = useMemo(
    () => (isSubmitting ? "Creating account..." : "Create account"),
    [isSubmitting],
  );

  if (!isHydrated) {
    return <div className="min-h-screen bg-bg" />;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[45%_55%]">
      <aside className="hidden flex-col justify-between bg-[#0F172A] px-10 py-8 text-white lg:flex">
        <div className="font-display text-xl font-semibold">SVGOI</div>

        <div className="max-w-xl space-y-8">
          <div className="space-y-4">
            <p className="font-display text-4xl font-bold leading-tight text-white">
              Transparent appraisals.
              <br />
              Meaningful growth.
            </p>
            <p className="max-w-lg text-base leading-7 text-slate-400">
              A structured, fair, and efficient performance review system for
              every role in your organisation.
            </p>
          </div>

          <div className="space-y-4">
            {[
              "Self-appraisal with guided scoring",
              "HOD and committee review workflows",
              "HR-level reporting and audit trails",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <Sparkles className="h-4 w-4 text-brand" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
          SVGOI Appraisal Management System
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 lg:px-10">
        <div className="w-full max-w-[360px] space-y-8">
          <div>
            <h1 className="font-display text-[26px] font-semibold tracking-tight text-text">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-text-2">
              Set up access to the appraisal system
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-text"
                htmlFor="fullName"
              >
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="Jane Doe"
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-surface-2"
                {...register("fullName")}
              />
              {errors.fullName ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.fullName.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-text"
                htmlFor="email"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@svgoi.org"
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-surface-2"
                {...register("email")}
              />
              {errors.email ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-text"
                htmlFor="departmentId"
              >
                Department
              </label>
              <select
                id="departmentId"
                disabled={disabled || loadingDepartments}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-surface-2"
                {...register("departmentId")}
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              {!departments.length && !loadingDepartments ? (
                <p className="mt-1 text-xs text-text-3">
                  Departments could not be loaded. You can continue without
                  selecting one.
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-text"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a secure password"
                  disabled={disabled}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 pr-11 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-surface-2"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-text-3 transition hover:text-text"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-text"
                htmlFor="confirmPassword"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-surface-2"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            {serverError ? (
              <div className="rounded-lg border border-danger/20 bg-danger-bg p-3 text-sm text-danger">
                {serverError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={disabled}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {submitLabel}
            </button>
          </form>

          <p className="text-sm text-text-2">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-brand transition hover:text-brand-dark"
            >
              Sign in →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
