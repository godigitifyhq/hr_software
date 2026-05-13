"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getPrimaryRole, getRoleHomePath } from "@/lib/utils/routing";

export default function Home() {
  const router = useRouter();
  const { session, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated && session) {
      router.replace(getRoleHomePath(getPrimaryRole(session.user.roles)));
    }
  }, [isHydrated, router, session]);

  if (!isHydrated) {
    return <div className="min-h-screen bg-bg" />;
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <section className="mx-auto flex min-h-screen max-w-[1440px] flex-col justify-center gap-12 px-6 py-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-10">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-text-2 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            SVGOI Appraisal Management System
          </div>
          <div className="space-y-4">
            <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl lg:text-6xl">
              Transparent appraisals.
              <br />
              Meaningful growth.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-text-2 sm:text-lg">
              A structured, fair, and efficient performance review system for
              every role in your organisation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
            >
              Create account
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-6 shadow-modal lg:justify-self-end">
          <div className="grid gap-4">
            {[
              {
                title: "Self-appraisal with guided scoring",
                icon: CheckCircle2,
              },
              {
                title: "HOD and committee review workflows",
                icon: ShieldCheck,
              },
              { title: "HR reporting with audit trails", icon: Sparkles },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-bg p-4 shadow-xs"
                >
                  <div className="mt-0.5 rounded-lg bg-brand-light p-2 text-brand">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-text">{item.title}</p>
                    <p className="mt-1 text-sm text-text-2">
                      Designed for clarity, compliance, and fast decision
                      making.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
