"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { withAuth } from "@/components/auth/withAuth";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/api-client";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

type HrUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  departmentId?: string | null;
  facultyProfile?: Record<string, unknown> | null;
  documents?: Array<{
    id: string;
    name: string;
    viewUrl?: string | null;
    directUrl?: string | null;
    module?: string | null;
    fieldKey?: string | null;
  }>;
  roles: Array<{ role: string }>;
  lockedUntil?: string | null;
};

type DepartmentSummary = { id: string; name: string };

const PROFILE_LABELS: Record<string, string> = {
  userId: "User ID",
  fatherName: "Father name",
  dob: "Date of birth",
  dateOfJoining: "Date of joining",
  currentSalary: "Current salary",
  lastIncrementDate: "Last increment date",
  panEncrypted: "PAN (encrypted)",
  aadharEncrypted: "Aadhaar (encrypted)",
  tenthMarks: "10th marks",
  twelfthMarks: "12th marks",
  qualification: "Qualification",
  graduation: "Graduation",
  postGraduation: "Post graduation",
  phdDegree: "PhD degree",
  imageUrl: "Profile image",
  createdAt: "Created at",
  updatedAt: "Updated at",
};

const DATE_FIELDS = new Set([
  "dob",
  "dateOfJoining",
  "lastIncrementDate",
  "createdAt",
  "updatedAt",
]);

function formatProfileLabel(key: string) {
  return (
    PROFILE_LABELS[key] ??
    key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())
  );
}

function formatProfileValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (DATE_FIELDS.has(key) && typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-GB");
    }
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (key === "imageUrl" && typeof value === "string") {
    return value.startsWith("http") ? value : `${API_ORIGIN}${value}`;
  }
  return String(value);
}

function HrFacultyPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const [users, setUsers] = useState<HrUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [selected, setSelected] = useState<HrUser | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    departmentId: "",
  });
  const [editForm, setEditForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    departmentId: "",
  });
  const [blockUntil, setBlockUntil] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [usersResponse, departmentsResponse] = await Promise.all([
          api.hr.getUsers(),
          api.departments.list(),
        ]);
        if (!active) return;
        setUsers(usersResponse.data ?? []);
        setDepartments(departmentsResponse.data ?? []);
      } catch (err: any) {
        if (active) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load faculty",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const facultyUsers = useMemo(() => {
    return users.filter((user) =>
      user.roles?.some((role) => role.role === "FACULTY"),
    );
  }, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return facultyUsers;
    return facultyUsers.filter((user) => {
      const haystack =
        `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [facultyUsers, search]);

  function selectUser(user: HrUser) {
    setSelected(user);
    setEditForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      departmentId: user.departmentId ?? "",
    });
    setBlockUntil("");
    setMessage(null);
    setError(null);
  }

  async function reloadUsers() {
    const response = await api.hr.getUsers();
    setUsers(response.data ?? []);
  }

  async function handleCreate() {
    try {
      setSaving(true);
      setError(null);
      await api.hr.createUser({
        email: createForm.email,
        password: createForm.password,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        departmentId: createForm.departmentId || undefined,
        roles: ["FACULTY"],
      });
      setMessage("Faculty account created.");
      setCreateForm({
        email: "",
        firstName: "",
        lastName: "",
        password: "",
        departmentId: "",
      });
      await reloadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selected) return;
    try {
      setSaving(true);
      setError(null);
      await api.hr.updateUser(selected.id, {
        email: editForm.email,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        departmentId: editForm.departmentId || undefined,
        roles: ["FACULTY"],
      });
      setMessage("Faculty account updated.");
      await reloadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleBlockTemporary() {
    if (!selected) return;
    try {
      setSaving(true);
      setError(null);
      await api.hr.blockUser(selected.id, blockUntil || undefined);
      setMessage("Faculty account temporarily disabled.");
      await reloadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Block failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleBlockPermanent() {
    if (!selected) return;
    try {
      setSaving(true);
      setError(null);
      await api.hr.blockUser(selected.id, "9999-12-31T00:00:00.000Z");
      setMessage("Faculty account permanently blocked.");
      await reloadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Block failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnblock() {
    if (!selected) return;
    try {
      setSaving(true);
      setError(null);
      await api.hr.unblockUser(selected.id);
      setMessage("Faculty account re-enabled.");
      await reloadUsers();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Unblock failed",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="Faculty"
        subtitle="Manage faculty profiles, access, and status."
      />

      {error ? (
        <div className="mb-4 rounded-2xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mb-4 rounded-2xl border border-success/20 bg-success-bg p-4 text-sm text-success">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                Faculty list
              </p>
              <p className="text-sm text-text-2">
                {facultyUsers.length} faculty members
              </p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm md:w-64"
            />
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-2">
                Loading faculty...
              </div>
            ) : null}

            {!loading && filtered.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-2">
                No faculty found.
              </div>
            ) : null}

            {filtered.map((user) => {
              const isLocked =
                user.lockedUntil &&
                new Date(user.lockedUntil).getTime() > Date.now();
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectUser(user)}
                  className={`w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition hover:border-brand/40 ${
                    selected?.id === user.id ? "border-brand/60" : ""
                  }`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-text">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-text-2">{user.email}</p>
                      <p className="text-xs text-text-3">
                        Department:{" "}
                        {departments.find((d) => d.id === user.departmentId)
                          ?.name ?? "-"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isLocked
                          ? "bg-danger-bg text-danger"
                          : "bg-success-bg text-success"
                      }`}
                    >
                      {isLocked ? "Disabled" : "Active"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-text">Create faculty</h3>
            <div className="mt-3 grid gap-3 text-sm">
              <input
                value={createForm.firstName}
                onChange={(event) =>
                  setCreateForm((curr) => ({
                    ...curr,
                    firstName: event.target.value,
                  }))
                }
                placeholder="First name"
                className="h-10 w-full rounded-lg border border-border bg-bg px-3"
              />
              <input
                value={createForm.lastName}
                onChange={(event) =>
                  setCreateForm((curr) => ({
                    ...curr,
                    lastName: event.target.value,
                  }))
                }
                placeholder="Last name"
                className="h-10 w-full rounded-lg border border-border bg-bg px-3"
              />
              <input
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((curr) => ({
                    ...curr,
                    email: event.target.value,
                  }))
                }
                placeholder="Email"
                className="h-10 w-full rounded-lg border border-border bg-bg px-3"
              />
              <input
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((curr) => ({
                    ...curr,
                    password: event.target.value,
                  }))
                }
                placeholder="Temporary password"
                className="h-10 w-full rounded-lg border border-border bg-bg px-3"
              />
              <select
                value={createForm.departmentId}
                onChange={(event) =>
                  setCreateForm((curr) => ({
                    ...curr,
                    departmentId: event.target.value,
                  }))
                }
                aria-label="Create faculty department"
                title="Create faculty department"
                className="h-10 w-full rounded-lg border border-border bg-bg px-3"
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Create faculty
              </button>
            </div>
          </section>
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:p-8">
          <div className="w-full max-w-8xl overflow-y-auto rounded-3xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                  Faculty details
                </p>
                <p className="text-lg font-semibold text-text">
                  {selected.firstName} {selected.lastName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-text"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-bg p-4">
                  <div>
                    <p className="text-sm text-text-2">{selected.email}</p>
                    <p className="text-xs text-text-3">
                      Department:{" "}
                      {departments.find((d) => d.id === selected.departmentId)
                        ?.name ?? "-"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        selected.lockedUntil &&
                        new Date(selected.lockedUntil).getTime() > Date.now()
                          ? "bg-danger-bg text-danger"
                          : "bg-success-bg text-success"
                      }`}
                    >
                      {selected.lockedUntil &&
                      new Date(selected.lockedUntil).getTime() > Date.now()
                        ? "Disabled"
                        : "Active"}
                    </span>
                    {selected.lockedUntil ? (
                      <p className="mt-2 text-[11px] text-text-3">
                        Locked until:{" "}
                        {new Date(selected.lockedUntil).toLocaleDateString(
                          "en-GB",
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-bg p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                      Profile
                    </p>
                    {selected.facultyProfile &&
                    (selected.facultyProfile as Record<string, unknown>)
                      .imageUrl ? (
                      <img
                        src={formatProfileValue(
                          "imageUrl",
                          (selected.facultyProfile as Record<string, unknown>)
                            .imageUrl,
                        )}
                        alt="Faculty profile"
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {selected.facultyProfile ? (
                      Object.entries(selected.facultyProfile).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="rounded-xl border border-border bg-surface px-3 py-2"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-text-3">
                              {formatProfileLabel(key)}
                            </p>
                            <p
                              className={`mt-1 text-xs text-text-2 ${
                                key.includes("Encrypted")
                                  ? "break-all font-mono"
                                  : ""
                              }`}
                            >
                              {formatProfileValue(key, value)}
                            </p>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="text-xs text-text-3">No profile data</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-bg p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                    Documents
                  </p>
                  <div className="mt-3 space-y-2">
                    {(selected.documents ?? []).length === 0 ? (
                      <div className="text-xs text-text-3">
                        No documents uploaded
                      </div>
                    ) : (
                      selected.documents?.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.directUrl ?? doc.viewUrl ?? "#"}
                          className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-xs text-brand"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>{doc.name}</span>
                          <span className="text-[11px] text-text-3">
                            {doc.module}/{doc.fieldKey}
                          </span>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-bg p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                    Edit account
                  </p>
                  <div className="mt-3 grid gap-2">
                    <input
                      value={editForm.firstName}
                      onChange={(event) =>
                        setEditForm((curr) => ({
                          ...curr,
                          firstName: event.target.value,
                        }))
                      }
                      placeholder="First name"
                      className="h-9 rounded-lg border border-border bg-surface px-3 text-xs"
                    />
                    <input
                      value={editForm.lastName}
                      onChange={(event) =>
                        setEditForm((curr) => ({
                          ...curr,
                          lastName: event.target.value,
                        }))
                      }
                      placeholder="Last name"
                      className="h-9 rounded-lg border border-border bg-surface px-3 text-xs"
                    />
                    <input
                      value={editForm.email}
                      onChange={(event) =>
                        setEditForm((curr) => ({
                          ...curr,
                          email: event.target.value,
                        }))
                      }
                      placeholder="Email"
                      className="h-9 rounded-lg border border-border bg-surface px-3 text-xs"
                    />
                    <select
                      value={editForm.departmentId}
                      onChange={(event) =>
                        setEditForm((curr) => ({
                          ...curr,
                          departmentId: event.target.value,
                        }))
                      }
                      aria-label="Edit faculty department"
                      title="Edit faculty department"
                      className="h-9 rounded-lg border border-border bg-surface px-3 text-xs"
                    >
                      <option value="">Select department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleUpdate}
                      disabled={saving}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text"
                    >
                      Save changes
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-bg p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-text-3">
                    Access controls
                  </p>
                  <div className="mt-3 grid gap-2">
                    <label className="text-xs text-text-2">
                      Temporary disable until (ISO or yyyy-mm-dd)
                    </label>
                    <input
                      value={blockUntil}
                      onChange={(event) => setBlockUntil(event.target.value)}
                      placeholder="2026-12-31"
                      className="h-9 rounded-lg border border-border bg-surface px-3 text-xs"
                    />
                    <div className="grid gap-2 sm:grid-cols-1">
                      <button
                        type="button"
                        onClick={handleBlockTemporary}
                        disabled={saving}
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-warning px-3 text-xs font-semibold text-white"
                      >
                        Temporarily disable
                      </button>
                      <button
                        type="button"
                        onClick={handleBlockPermanent}
                        disabled={saving}
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-danger px-3 text-xs font-semibold text-white"
                      >
                        Permanently block
                      </button>
                      <button
                        type="button"
                        onClick={handleUnblock}
                        disabled={saving}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text"
                      >
                        Re-enable access
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default withAuth(HrFacultyPage, ["HR", "ADMIN", "SUPER_ADMIN"]);
