"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  ChevronDown,
  Loader2,
  Plus,
  Pencil,
  Users,
  X,
  Check,
  UserPlus,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { withAuth } from "@/components/auth/withAuth";
import {
  api,
  type HrDepartmentSummary,
  type HrUserSummary,
} from "@/lib/api";
import { getPrimaryRole } from "@/lib/utils/routing";
import { useAuthStore } from "@/store/auth";

type EditingState = {
  id: string;
  name: string;
  code: string;
  hodId: string;
};

type CreateMode = "existing-hod" | "new-hod";

const EMPTY_NEW_DEPT = {
  name: "",
  code: "",
  hodId: "",
  hodFirstName: "",
  hodLastName: "",
  hodEmail: "",
  hodPassword: "",
};

function HrDepartmentsPage() {
  const { session } = useAuthStore();
  const role = getPrimaryRole(session?.user.roles ?? []);
  const { toast } = useToast();

  const [departments, setDepartments] = useState<HrDepartmentSummary[]>([]);
  const [users, setUsers] = useState<HrUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("new-hod");
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [newDept, setNewDept] = useState(EMPTY_NEW_DEPT);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  async function loadData() {
    try {
      setLoading(true);
      const [deptsRes, usersRes] = await Promise.all([
        api.hr.getDepartments(),
        api.hr.getUsers(),
      ]);
      setDepartments(deptsRes.data ?? []);
      setUsers(usersRes.data ?? []);
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err?.response?.data?.message || err?.message || "Failed to load",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreate() {
    if (!newDept.name.trim()) return;

    if (
      createMode === "new-hod" &&
      (!newDept.hodFirstName.trim() ||
        !newDept.hodLastName.trim() ||
        !newDept.hodEmail.trim() ||
        !newDept.hodPassword.trim())
    ) {
      toast({
        title: "Error",
        description:
          "All HOD credential fields are required when creating a new HOD.",
        variant: "error",
      });
      return;
    }

    if (createMode === "new-hod" && newDept.hodPassword.trim().length < 8) {
      toast({
        title: "Error",
        description: "HOD password must be at least 8 characters long.",
        variant: "error",
      });
      return;
    }

    try {
      setSaving(true);

      if (createMode === "new-hod") {
        await api.hr.createDepartment({
          name: newDept.name.trim(),
          code: newDept.code.trim() || undefined,
          hod: {
            firstName: newDept.hodFirstName.trim(),
            lastName: newDept.hodLastName.trim(),
            email: newDept.hodEmail.trim(),
            password: newDept.hodPassword,
          },
        });
      } else {
        await api.hr.createDepartment({
          name: newDept.name.trim(),
          code: newDept.code.trim() || undefined,
          hodId: newDept.hodId || undefined,
        });
      }

      setNewDept(EMPTY_NEW_DEPT);
      setShowCreate(false);
      await loadData();
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to create department",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    try {
      setSaving(true);
      await api.hr.updateDepartment(editing.id, {
        name: editing.name.trim(),
        code: editing.code.trim() || undefined,
        hodId: editing.hodId || null,
      });
      setEditing(null);
      await loadData();
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update department",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleDeptExpanded(deptId: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  }

  const hodEligibleUsers = users.filter(
    (u) =>
      u.roles.some((r) => r.role === "HOD") ||
      u.roles.some((r) => r.role === "FACULTY"),
  );

  return (
    <AppShell role={role}>
      <PageHeader
        title="Departments"
        subtitle="Manage department records and HOD assignments."
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" />
            New Department
          </button>
        }
      />

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-2xl border border-brand/30 bg-brand-light/20 p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-text">Create New Department</h3>

          {/* Dept name + code */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="new-dept-name"
                className="mb-1 block text-xs font-medium text-text-3"
              >
                Department Name *
              </label>
              <input
                id="new-dept-name"
                type="text"
                value={newDept.name}
                onChange={(e) =>
                  setNewDept((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Computer Science"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="new-dept-code"
                className="mb-1 block text-xs font-medium text-text-3"
              >
                Code
              </label>
              <input
                id="new-dept-code"
                type="text"
                value={newDept.code}
                onChange={(e) =>
                  setNewDept((p) => ({ ...p, code: e.target.value }))
                }
                placeholder="e.g. CS"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          {/* HOD mode toggle */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-text-3">HOD Setup</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreateMode("new-hod")}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
                  createMode === "new-hod"
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface text-text hover:bg-surface-2"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Create New HOD
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("existing-hod")}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
                  createMode === "existing-hod"
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface text-text hover:bg-surface-2"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Assign Existing User
              </button>
            </div>
          </div>

          {createMode === "new-hod" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="hod-first-name"
                  className="mb-1 block text-xs font-medium text-text-3"
                >
                  HOD First Name *
                </label>
                <input
                  id="hod-first-name"
                  type="text"
                  value={newDept.hodFirstName}
                  onChange={(e) =>
                    setNewDept((p) => ({ ...p, hodFirstName: e.target.value }))
                  }
                  placeholder="First name"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="hod-last-name"
                  className="mb-1 block text-xs font-medium text-text-3"
                >
                  HOD Last Name *
                </label>
                <input
                  id="hod-last-name"
                  type="text"
                  value={newDept.hodLastName}
                  onChange={(e) =>
                    setNewDept((p) => ({ ...p, hodLastName: e.target.value }))
                  }
                  placeholder="Last name"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="hod-email"
                  className="mb-1 block text-xs font-medium text-text-3"
                >
                  HOD Email *
                </label>
                <input
                  id="hod-email"
                  type="email"
                  value={newDept.hodEmail}
                  onChange={(e) =>
                    setNewDept((p) => ({ ...p, hodEmail: e.target.value }))
                  }
                  placeholder="hod@college.edu"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="hod-password"
                  className="mb-1 block text-xs font-medium text-text-3"
                >
                  HOD Password * (min 8 chars)
                </label>
                <input
                  id="hod-password"
                  type="password"
                  value={newDept.hodPassword}
                  onChange={(e) =>
                    setNewDept((p) => ({ ...p, hodPassword: e.target.value }))
                  }
                  placeholder="Temporary password"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="new-dept-hod"
                className="mb-1 block text-xs font-medium text-text-3"
              >
                Assign Existing User as HOD
              </label>
              <select
                id="new-dept-hod"
                title="Assign HOD"
                value={newDept.hodId}
                onChange={(e) =>
                  setNewDept((p) => ({ ...p, hodId: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
              >
                <option value="">— None —</option>
                {hodEligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving || !newDept.name.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inv shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewDept(EMPTY_NEW_DEPT);
                setCreateMode("new-hod");
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition hover:bg-surface-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3 text-text-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading departments...</span>
          </div>
        </div>
      ) : departments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-text-3" />
          <p className="font-medium text-text">No departments yet</p>
          <p className="mt-1 text-sm text-text-2">
            Create your first department to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map((dept) =>
            editing?.id === dept.id ? (
              /* Inline edit row */
              <div
                key={dept.id}
                className="rounded-2xl border border-brand/30 bg-brand-light/10 p-4 shadow-sm"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="edit-dept-name"
                      className="mb-1 block text-xs font-medium text-text-3"
                    >
                      Name
                    </label>
                    <input
                      id="edit-dept-name"
                      type="text"
                      placeholder="Department name"
                      value={editing.name}
                      onChange={(e) =>
                        setEditing((p) => p && { ...p, name: e.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-dept-code"
                      className="mb-1 block text-xs font-medium text-text-3"
                    >
                      Code
                    </label>
                    <input
                      id="edit-dept-code"
                      type="text"
                      placeholder="Dept code"
                      value={editing.code}
                      onChange={(e) =>
                        setEditing((p) => p && { ...p, code: e.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-dept-hod"
                      className="mb-1 block text-xs font-medium text-text-3"
                    >
                      HOD
                    </label>
                    <select
                      id="edit-dept-hod"
                      title="Assign HOD"
                      value={editing.hodId}
                      onChange={(e) =>
                        setEditing((p) => p && { ...p, hodId: e.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:outline-none"
                    >
                      <option value="">— None —</option>
                      {hodEligibleUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleUpdate()}
                    disabled={saving}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-text-inv transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition hover:bg-surface-2"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <article
                key={dept.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
              >
                {/* Department header */}
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light">
                      <Building2 className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <p className="font-semibold text-text">
                        {dept.name}
                        {dept.code && (
                          <span className="ml-2 rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-2">
                            {dept.code}
                          </span>
                        )}
                      </p>
                      {dept.hod ? (
                        <p className="text-xs text-text-2">
                          HOD: {dept.hod.firstName} {dept.hod.lastName}
                        </p>
                      ) : (
                        <p className="text-xs text-text-3">No HOD assigned</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleDeptExpanded(dept.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text transition hover:bg-surface-2"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{dept._count?.users ?? dept.users?.length ?? 0} members</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          expandedDepts.has(dept.id) ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: dept.id,
                          name: dept.name,
                          code: dept.code ?? "",
                          hodId: dept.hodId ?? "",
                        })
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text transition hover:bg-surface-2"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </div>
                </div>

                {/* Expandable faculty list */}
                {expandedDepts.has(dept.id) && (
                  <div className="border-t border-border bg-surface-2 px-4 py-3">
                    {!dept.users || dept.users.length === 0 ? (
                      <p className="text-sm text-text-3">
                        No faculty members assigned to this department.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-3">
                          Faculty Members
                        </p>
                        {dept.users.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between rounded-lg bg-surface px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-text">
                                {member.firstName} {member.lastName}
                              </p>
                              <p className="text-xs text-text-3">{member.email}</p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {member.roles.map((r) => (
                                <span
                                  key={r.role}
                                  className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-medium text-brand"
                                >
                                  {r.role}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ),
          )}
        </div>
      )}
    </AppShell>
  );
}

export default withAuth(HrDepartmentsPage, ["HR", "ADMIN", "SUPER_ADMIN"]);
