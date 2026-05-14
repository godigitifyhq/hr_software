"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Save, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

function fullEvidenceUrl(url: string) {
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

type ItemState = Record<string, { approvedPoints: number; remark?: string }>;

function HRReviewDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);

  useEffect(() => {
    if (!session) {
      router.push("/login");
    }
  }, [session, router]);

  const [appraisal, setAppraisal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [itemState, setItemState] = useState<ItemState>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const response = await api.hr.getById(id);
        if (!active) return;
        setAppraisal(response.data);

        const initial: Record<string, any> = {};
        (response.data.items || []).forEach((it: any) => {
          initial[it.id] = {
            approvedPoints:
              it.committeeApprovedPoints ??
              it.hodApprovedPoints ??
              it.facultyPoints,
            remark: it.committeeRemark ?? "",
          };
        });
        setItemState(initial);
      } catch (err: any) {
        if (active)
          setError(
            err?.response?.data?.message || err?.message || "Failed to load",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const totalApproved = useMemo(
    () =>
      Object.values(itemState).reduce(
        (s: number, it: any) => s + Number(it.approvedPoints || 0),
        0,
      ),
    [itemState],
  );

  function updateItem(
    id: string,
    patch: Partial<{ approvedPoints: number; remark?: string }>,
  ) {
    setItemState((curr) => ({
      ...curr,
      [id]: { ...(curr[id] || {}), ...patch },
    }));
  }

  async function submit() {
    if (!appraisal) return;

    const items = appraisal.items.map((it: any) => ({
      itemId: it.id,
      approvedPoints: Number(itemState[it.id]?.approvedPoints || 0),
      remark: (itemState[it.id]?.remark || "").trim() || undefined,
    }));

    const hasDeduction = appraisal.items.some((it: any) => {
      const upper =
        it.committeeApprovedPoints ?? it.hodApprovedPoints ?? it.facultyPoints;
      return Number(itemState[it.id]?.approvedPoints || 0) < upper;
    });

    if (hasDeduction) {
      const missing = appraisal.items.some((it: any) => {
        const upper =
          it.committeeApprovedPoints ??
          it.hodApprovedPoints ??
          it.facultyPoints;
        if (Number(itemState[it.id]?.approvedPoints || 0) < upper) {
          return !(itemState[it.id]?.remark || "").trim();
        }
        return false;
      });
      if (missing) {
        setError("Please provide remarks for deductions");
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      await api.hr.submitReview(id, { items });
      setMessage("HR review submitted");
      setTimeout(() => router.push("/hr-review"), 800);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading appraisal...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!appraisal) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <PageHeader
          title="HR Appraisal"
          subtitle="Not found"
          actions={
            <Link
              href="/hr-review"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm"
            >
              Back
            </Link>
          }
        />
        <div className="p-4">Not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader
        title="HR Appraisal Review"
        subtitle={`${appraisal.user?.firstName} ${appraisal.user?.lastName}`}
        actions={
          <Link
            href="/hr-review"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm"
          >
            Back
          </Link>
        }
      />
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          Status: {appraisal.status}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          Final Score: {appraisal.finalScore ?? 0}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          Total Approved: {totalApproved}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h4 className="text-sm font-semibold">Employee</h4>
            <div className="mt-2 text-sm">
              <div className="font-medium">
                {appraisal.user?.firstName} {appraisal.user?.lastName}
              </div>
              <div className="text-text-2">{appraisal.user?.email}</div>
              <div className="text-text-3 text-xs mt-1">
                Department: {appraisal.user?.department?.name ?? "-"}
              </div>
            </div>
          </section>

          {appraisal.user?.facultyProfile ? (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h4 className="text-sm font-semibold">Profile</h4>
              <div className="mt-2 text-sm space-y-1">
                <div>
                  DOB:{" "}
                  {appraisal.user.facultyProfile.dob
                    ? String(appraisal.user.facultyProfile.dob).slice(0, 10)
                    : "-"}
                </div>
                <div>
                  Date of joining:{" "}
                  {appraisal.user.facultyProfile.dateOfJoining
                    ? String(appraisal.user.facultyProfile.dateOfJoining).slice(
                        0,
                        10,
                      )
                    : "-"}
                </div>
                <div>
                  Total experience:{" "}
                  {typeof appraisal.user.facultyProfile.totalExperience ===
                  "number"
                    ? appraisal.user.facultyProfile.totalExperience
                    : "-"}
                </div>
                <div>
                  Qualification:{" "}
                  {appraisal.user.facultyProfile.qualification ?? "-"}
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-surface p-4">
            <h4 className="text-sm font-semibold">Documents</h4>
            <div className="mt-2 flex flex-col gap-2 text-sm">
              {(appraisal.user?.documents ?? []).map((doc: any) => (
                <a
                  key={doc.id}
                  href={doc.directUrl ?? doc.viewUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand"
                >
                  {doc.name}{" "}
                  <span className="text-xs text-text-2">
                    ({doc.module}/{doc.fieldKey})
                  </span>
                </a>
              ))}
              {(appraisal.user?.documents ?? []).length === 0 ? (
                <div className="text-text-2">No documents uploaded</div>
              ) : null}
            </div>
          </section>
        </aside>

        <div className="space-y-4">
          {appraisal.items.map((it: any) => (
            <section
              key={it.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <h3 className="font-semibold">{it.heading ?? it.key}</h3>
              <p className="text-sm text-text-2">
                Faculty selected: {it.selectedLabel || it.selectedValue}
              </p>
              <p className="text-sm text-text-2">
                HOD: {it.hodRemark || "-"} | HOD Points: {it.hodApprovedPoints}
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <label className="block text-sm">Approved points</label>
                  <input
                    type="number"
                    value={itemState[it.id]?.approvedPoints ?? 0}
                    onChange={(e) =>
                      updateItem(it.id, {
                        approvedPoints: Number(e.target.value),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-border px-3"
                    aria-label={`Approved points for ${it.heading ?? it.key}`}
                    title={`Approved points for ${it.heading ?? it.key}`}
                  />
                </div>
                <div>
                  <label className="block text-sm">
                    Remark{" "}
                    {(itemState[it.id]?.approvedPoints ?? 0) <
                    (it.hodApprovedPoints ?? it.points)
                      ? "(Required)"
                      : "(Optional)"}
                  </label>
                  <input
                    value={itemState[it.id]?.remark ?? ""}
                    onChange={(e) =>
                      updateItem(it.id, { remark: e.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-border px-3"
                    aria-label={`Remark for ${it.heading ?? it.key}`}
                    title={`Remark for ${it.heading ?? it.key}`}
                  />
                </div>
              </div>
              {it.evidence?.url ? (
                <div className="mt-2">
                  <a
                    href={fullEvidenceUrl(it.evidence.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand"
                  >
                    View evidence <ExternalLink className="inline h-4 w-4" />
                  </a>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {error ? <div className="text-sm text-danger">{error}</div> : null}
        {message ? <div className="text-sm text-success">{message}</div> : null}
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-white"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}{" "}
          Submit
        </button>
      </div>
    </div>
  );
}

export default HRReviewDetail;
