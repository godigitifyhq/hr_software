"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { withAuth } from "@/components/auth/withAuth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  AppraisalItemRow,
  type AppraisalItemView,
} from "@/components/ui/AppraisalItemRow";
import { api, type AppraisalSummary } from "@/lib/api";
import { formatDateTime, relativeDate } from "@/lib/utils/dates";
import { calcCompletedCount, calcWeightedScore } from "@/lib/utils/scores";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";
import { appraisalItemSchema } from "@svgoi/zod-schemas";

type EditableItem = AppraisalItemView & {
  key: string;
  weight: number;
  points: number | null;
  notes: string;
};

const itemsArraySchema = z.array(appraisalItemSchema);

function AppraisalEditPage() {
  const router = useRouter();
  const params = useParams();
  const appraisalId = params?.id as string;
  const { session } = useAuthStore();
  const [appraisal, setAppraisal] = useState<AppraisalSummary | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const role = getPrimaryRole(session?.user.roles ?? []);

  useEffect(() => {
    let active = true;

    async function loadAppraisal() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.appraisals.getById(appraisalId);

        if (active) {
          setAppraisal(response.data);
          setItems(
            (response.data.items ?? []).map((item) => ({
              id: item.id,
              key: item.key ?? item.label ?? "",
              label: item.label ?? item.key,
              weight: item.weight,
              selfScore: item.points ?? item.selfScore ?? null,
              hodScore: item.hodScore ?? null,
              committeeScore: item.committeeScore ?? null,
              points: item.points ?? null,
              notes: item.notes ?? "",
            })),
          );
          setLastSavedAt(
            response.data.updatedAt ?? response.data.createdAt ?? null,
          );
        }
      } catch (fetchError: any) {
        if (active) {
          setError(
            fetchError?.response?.data?.message ||
              fetchError?.message ||
              "Failed to load appraisal for editing",
          );
          setAppraisal(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (appraisalId) {
      void loadAppraisal();
    }

    return () => {
      active = false;
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [appraisalId]);

  const canEdit = appraisal?.status === "DRAFT" && !appraisal.locked;
  const completedCount = useMemo(
    () =>
      calcCompletedCount(
        items.map((item) => ({ selfScore: item.points ?? 0 })),
        "selfScore",
      ),
    [items],
  );
  const validItems = useMemo(
    () =>
      itemsArraySchema.safeParse(
        items.map((item) => ({
          selfScore: item.points ?? 0,
          comment: item.notes ?? "",
        })),
      ),
    [items],
  );
  const hasMissingScore = items.some(
    (item) => item.points === null || item.points === undefined,
  );
  const weightedScore = useMemo(
    () =>
      calcWeightedScore(
        items.map((item) => ({ weight: item.weight, selfScore: item.points })),
      ),
    [items],
  );

  const persistDraft = async () => {
    if (!canEdit) {
      return;
    }

    if (!validItems.success || hasMissingScore) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await api.appraisals.update(appraisalId, {
        items: items.map((item) => ({
          id: item.id,
          key: item.key,
          points: item.points ?? 0,
          weight: item.weight,
          notes: item.notes?.trim() || undefined,
        })),
      });

      setAppraisal(response.data);
      setLastSavedAt(new Date().toISOString());
      setIsDirty(false);
    } catch (saveError: any) {
      setError(
        saveError?.response?.data?.message ||
          saveError?.message ||
          "Failed to save draft",
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!canEdit || !appraisal) {
      return;
    }

    if (!isDirty) {
      return;
    }

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }

    saveTimer.current = window.setTimeout(() => {
      void persistDraft();
    }, 2000);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [appraisal, canEdit, isDirty, items]);

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    setItems((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setIsDirty(true);
  };

  const saveDraftNow = async () => {
    await persistDraft();
  };

  const submitAppraisal = async () => {
    await persistDraft();
    await api.appraisals.submit(appraisalId);
    router.push("/appraisals");
  };

  if (loading) {
    return (
      <AppShell role={role}>
        <div className="space-y-4">
          <div className="h-20 rounded-2xl border border-border bg-surface animate-pulse" />
          <div className="h-40 rounded-2xl border border-border bg-surface animate-pulse" />
        </div>
      </AppShell>
    );
  }

  if (error && !appraisal) {
    return (
      <AppShell role={role}>
        <EmptyState
          title="Unable to open appraisal"
          description={error}
          action={
            <Link
              href="/appraisals"
              className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
            >
              Back to appraisals
            </Link>
          }
        />
      </AppShell>
    );
  }

  if (!canEdit) {
    return (
      <AppShell role={role}>
        <EmptyState
          title="This appraisal can no longer be edited"
          description="Only unlocked draft appraisals can be updated."
          action={
            <Link
              href={`/appraisals/${appraisalId}`}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
            >
              Back to appraisal
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <div className="sticky top-0 z-20 -mx-6 mb-6 border-b border-border bg-bg/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/appraisals/${appraisalId}`}
              className="text-sm font-medium text-text-2 transition hover:text-text"
            >
              ← Back to appraisal
            </Link>
            <h1 className="mt-1 font-display text-2xl font-semibold text-text">
              Self-Appraisal — {appraisal?.cycle?.name ?? "Current cycle"}
            </h1>
            <p className="mt-1 text-sm text-text-2">
              {lastSavedAt
                ? `Saved ${relativeDate(lastSavedAt)}`
                : "Auto-saved after changes"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void saveDraftNow()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => setSubmitOpen(true)}
              disabled={hasMissingScore || !validItems.success}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              Submit Appraisal
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Completion
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-text">
            {completedCount}/{items.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Weighted score
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-text">
            {weightedScore.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
            Auto-save
          </p>
          <p className="mt-2 text-sm text-text-2">
            {saving
              ? "Saving..."
              : lastSavedAt
              ? `Saved ${relativeDate(lastSavedAt)}`
              : "Waiting for your first change"}
          </p>
        </div>
      </section>

      <div className="space-y-4">
        {items.map((item, index) => {
          const scoreError =
            item.points === null || item.points === undefined
              ? "Please select a score before submitting."
              : undefined;

          return (
            <AppraisalItemRow
              key={item.id ?? `${item.key}-${index}`}
              item={item}
              mode="self"
              onChange={(patch) =>
                updateItem(index, { ...patch, notes: patch.notes ?? undefined })
              }
              notesValue={item.notes}
              onNotesChange={(value) => updateItem(index, { notes: value })}
              error={scoreError}
            />
          );
        })}
      </div>

      <div className="sticky bottom-0 left-0 right-0 mt-8 border-t border-border bg-surface/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-2">
            {completedCount} of {items.length} items scored
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void saveDraftNow()}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => setSubmitOpen(true)}
              disabled={hasMissingScore}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              Submit Appraisal
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={submitOpen}
        title="Submit appraisal"
        description="Once submitted, you cannot edit your appraisal. Are you sure you want to submit?"
        confirmLabel="Confirm Submit"
        onCancel={() => setSubmitOpen(false)}
        onConfirm={() => {
          setSubmitOpen(false);
          void submitAppraisal();
        }}
      />
    </AppShell>
  );
}

export default withAuth(AppraisalEditPage, ["EMPLOYEE"]);
