"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@svgoi/zod-schemas";
import { api } from "@/lib/api";
import { resolvePostLoginPath } from "@/lib/faculty-access";
import { useAuthStore } from "@/store/auth";

export default function LoginPage() {
  const router = useRouter();
  const { session, isHydrated } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdMessage, setCreatedMessage] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setCreatedMessage(params.get("created") === "1");
  }, [isHydrated]);

  useEffect(() => {
    let active = true;

    async function redirectAuthenticatedUser() {
      if (!isHydrated || !session) {
        return;
      }

      const nextPath = await resolvePostLoginPath(session.user.roles);
      if (active) {
        router.replace(nextPath);
      }
    }

    void redirectAuthenticatedUser();

    return () => {
      active = false;
    };
  }, [isHydrated, router, session]);

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);

    try {
      const response = await api.auth.login(values);
      useAuthStore.getState().setSession({
        accessToken: response.data.accessToken,
        user: response.data.user,
      });
      let nextPath = "/profile?complete=1";
      try {
        nextPath = await resolvePostLoginPath(response.data.user.roles);
      } catch {
        nextPath = response.data.user.roles.includes("FACULTY")
          ? "/profile?complete=1"
          : "/";
      }
      router.push(nextPath);
    } catch {
      setServerError("Invalid email or password. Please try again.");
    }
  };

  const disabled = isSubmitting;
  const submitLabel = useMemo(
    () => (isSubmitting ? "Signing in..." : "Sign in"),
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
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-text-2">Sign in to your account</p>
          </div>

          {createdMessage ? (
            <div className="rounded-lg border border-success/20 bg-success-bg p-3 text-sm text-success">
              Account created. Please sign in with your new credentials.
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
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

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-text-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                />
                Remember me
              </label>
              <a
                href="mailto:hr@svgoi.org"
                className="text-brand transition hover:text-brand-dark"
              >
                Forgot password?
              </a>
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
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-brand transition hover:text-brand-dark"
            >
              Register →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
