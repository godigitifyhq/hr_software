"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Pause, Play, Plus, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { withAuth } from "@/components/auth/withAuth";
import { api, type HrCycleSummary } from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type CreateCycleForm = {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

function HrCyclesPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  const [cycles, setCycles] = useState<HrCycleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCycleForm>({
    name: "",
    startDate: "",
    endDate: "",
    isActive: false,
  });

  async function loadCycles() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.hr.getCycles();
      setCycles(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load cycles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCycles();
  }, []);

  async function handleCreateCycle(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.startDate || !form.endDate) {
      setCreateError("Name, start date, and end date are required");
      return;
    }
    try {
      setCreating(true);
      setCreateError(null);
      await api.hr.createCycle({
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        isActive: form.isActive,
      });
      setShowCreateModal(false);
      setForm({ name: "", startDate: "", endDate: "", isActive: false });
      await loadCycles();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || err?.message || "Failed to create cycle");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(cycle: HrCycleSummary) {
    try {
      setToggling(cycle.id);
      setError(null);
      await api.hr.updateCycle(cycle.id, { isActive: !cycle.isActive });
      await loadCycles();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update cycle");
    } finally {
      setToggling(null);
    }
  }

  const today = new Date();
  const activeCycles = cycles.filter((c) => c.isActive);
  const upcomingCycles = cycles.filter(
    (c) => !c.isActive && new Date(c.startDate) > today,
  );
  const pastCycles = cycles.filter(
    (c) => !c.isActive && new Date(c.startDate) <= today,
  );

  return (
    <AppShell role={role}>
      <PageHeader
        title="Appraisal Cycles"
        subtitle="Create, activate, or pause appraisal cycles. HR controls when employees can submit."
        actions={
          <button
            type="button"
            onClick={() => { setShowCreateModal(true); setCreateError(null); }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" />
            New Cycle
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-brand/20 bg-brand-light/30 p-4 text-sm">
        <p className="font-medium text-brand">HR-controlled access</p>
        <p className="mt-1 text-text-2">
          When a cycle is <strong>active</strong>, all eligible employees can fill the appraisal form.
          Pausing a cycle closes access for everyone. Use <strong>New Cycle</strong> to start a fresh
          appraisal round.
        </p>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-text">New Appraisal Cycle</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-text-3 hover:bg-surface-2 hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg p-3 text-sm text-danger">
                {createError}
              </div>
            )}

            <form onSubmit={(e) => void handleCreateCycle(e)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">
                  Cycle Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Appraisal 2025-26"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-3 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    title="Start Date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    title="End Date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-brand"
                />
                <span className="text-sm text-text">
                  Activate immediately (open submissions now)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-text transition hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading cycles...</span>
          </div>
        </div>
      ) : cycles.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-text-3" />
          <p className="font-medium text-text">No cycles yet</p>
          <p className="mt-1 text-sm text-text-2">
            Appraisal cycles are created automatically by the system.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeCycles.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-success">
                Active — Submissions Open
              </h2>
              <div className="space-y-3">
                {activeCycles.map((cycle) => (
                  <CycleCard
                    key={cycle.id}
                    cycle={cycle}
                    toggling={toggling}
                    onToggle={toggleActive}
                  />
                ))}
              </div>
            </section>
          )}

          {upcomingCycles.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcomingCycles.map((cycle) => (
                  <CycleCard
                    key={cycle.id}
                    cycle={cycle}
                    toggling={toggling}
                    onToggle={null}
                  />
                ))}
              </div>
            </section>
          )}

          {pastCycles.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-3">
                Paused / Closed
              </h2>
              <div className="space-y-3">
                {pastCycles.map((cycle) => (
                  <CycleCard
                    key={cycle.id}
                    cycle={cycle}
                    toggling={toggling}
                    onToggle={toggleActive}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function CycleCard({
  cycle,
  toggling,
  onToggle,
}: {
  cycle: HrCycleSummary;
  toggling: string | null;
  onToggle: ((c: HrCycleSummary) => Promise<void>) | null;
}) {
  const isLoading = toggling === cycle.id;
  const today = new Date();
  const isUpcoming = !cycle.isActive && new Date(cycle.startDate) > today;

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm transition ${
        cycle.isActive
          ? "border-success/30 bg-success-bg/20"
          : isUpcoming
            ? "border-brand/20 bg-brand-light/10"
            : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
              cycle.isActive
                ? "bg-success"
                : isUpcoming
                  ? "bg-brand"
                  : "bg-text-3"
            }`}
          />
          <div>
            <p className="font-semibold text-text">{cycle.name}</p>
            <p className="mt-0.5 text-xs text-text-2">
              {formatDate(cycle.startDate)} — {formatDate(cycle.endDate)}
            </p>
            <p className="mt-1 text-xs text-text-3">
              {cycle._count?.appraisals ?? 0} appraisals in this cycle
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              cycle.isActive
                ? "bg-success-bg text-success"
                : isUpcoming
                  ? "bg-brand-light text-brand"
                  : "bg-surface-2 text-text-2"
            }`}
          >
            {cycle.isActive ? "Active" : isUpcoming ? "Upcoming" : "Paused"}
          </span>

          {!isUpcoming && onToggle && (
            <button
              type="button"
              onClick={() => void onToggle(cycle)}
              disabled={isLoading}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-60 ${
                cycle.isActive
                  ? "border border-border bg-surface text-text hover:bg-surface-2"
                  : "bg-brand text-text-inv shadow-sm hover:bg-brand-dark"
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : cycle.isActive ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {cycle.isActive ? "Pause Submissions" : "Resume Submissions"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default withAuth(HrCyclesPage, ["HR", "ADMIN", "SUPER_ADMIN"]);
