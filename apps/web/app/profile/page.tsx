// apps/web/app/profile/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { LogOut, Mail, Shield, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { withAuth } from "@/components/auth/withAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function ProfilePage() {
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
    <AppShell role={role}>
      <PageHeader
        title="My Profile"
        subtitle="Review your account details and active role."
      />

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
    </AppShell>
  );
}

export default withAuth(ProfilePage);
