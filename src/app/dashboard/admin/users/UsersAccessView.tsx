"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  USER_CSV_TEMPLATE,
  USER_MANAGEMENT_ROLE_OPTIONS,
  USER_MANAGEMENT_STATUSES,
} from "@/lib/platform/identity/user-management-catalog";
import type { AdminDirectoryUser } from "@/lib/platform/identity/queries";
import {
  activateUserAction,
  assignUserRoleAction,
  assignUserSchoolsAction,
  bulkAssignRoleAction,
  bulkAssignSchoolAction,
  bulkDeactivateAction,
  createUserAction,
  deactivateUserAction,
  deleteUserAction,
  importUsersCsvAction,
  inviteUsersAction,
  resetPasswordAction,
  updateUserProfileAction,
} from "@/lib/platform/identity/user-management-actions";
import { startImpersonationAction } from "@/lib/platform/identity/server-actions";
import {
  EntityActionMenu,
  type EntityMenuAction,
} from "@/components/platform/crud/EntityActionMenu";
import { EmailLink } from "@/components/platform/contact/ContactLink";

type OrgOption = { id: string; name: string };
type SchoolOption = { id: string; name: string };
type DeptOption = { id: string; name: string };

type Modal =
  | "add"
  | "edit-profile"
  | "import"
  | "invite"
  | "assign-school"
  | "assign-role"
  | null;

function profileDefaults(user: AdminDirectoryUser) {
  const display =
    user.display_name?.trim() || user.full_name?.trim() || "";
  const parts = display.split(/\s+/).filter(Boolean);
  return {
    firstName: user.first_name?.trim() || parts[0] || "",
    lastName:
      user.last_name?.trim() ||
      (parts.length > 1 ? parts.slice(1).join(" ") : ""),
    displayName: display,
    title: user.title?.trim() || "",
  };
}

function statusTone(status: AdminDirectoryUser["status"]) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "pending_invite") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Route-owned Users & Access UI (not the legacy assignments table). */
export function UsersAccessView({
  users,
  schools,
  organizations,
  departments,
  canManage,
  canImpersonate,
  isFounder,
  defaultOrganizationId,
}: {
  users: AdminDirectoryUser[];
  schools: SchoolOption[];
  organizations: OrgOption[];
  departments: DeptOption[];
  canManage: boolean;
  canImpersonate: boolean;
  isFounder: boolean;
  defaultOrganizationId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [
        u.display_name,
        u.full_name,
        u.title,
        u.email,
        u.roles.join(" "),
        u.schools.join(" "),
        u.department,
        u.statusLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, search]);

  const orgId = defaultOrganizationId ?? organizations[0]?.id ?? "";

  function refresh(msg?: string) {
    setMessage(msg ?? null);
    setError(null);
    setModal(null);
    setActionUserId(null);
    router.refresh();
  }

  function runAction(fn: () => Promise<{ error?: string; success?: boolean; created?: number; errors?: string[] }>, successMsg: string) {
    setError(null);
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await fn();
        if (result.error) {
          setError(result.error);
          return;
        }
        const extra =
          typeof result.created === "number"
            ? ` (${result.created} created${result.errors?.length ? `; ${result.errors.length} skipped` : ""})`
            : "";
        refresh(`${successMsg}${extra}`);
      })();
    });
  }

  function actionsForUser(user: AdminDirectoryUser): EntityMenuAction[] {
    const actions: EntityMenuAction[] = [];
    if (canManage) {
      actions.push(
        {
          id: "edit-profile",
          label: "Edit",
          onSelect: () => {
            setActionUserId(user.id);
            setModal("edit-profile");
          },
        },
        {
          id: "assign-role",
          label: "Assign Role",
          onSelect: () => {
            setActionUserId(user.id);
            setModal("assign-role");
          },
        },
        {
          id: "assign-school",
          label: "Assign School",
          onSelect: () => {
            setActionUserId(user.id);
            setModal("assign-school");
          },
        },
        {
          id: "toggle-active",
          label: user.status === "inactive" ? "Enable" : "Disable",
          onSelect: () => {
            const fd = new FormData();
            fd.set("user_id", user.id);
            runAction(
              () =>
                user.status === "inactive"
                  ? activateUserAction(fd)
                  : deactivateUserAction(fd),
              user.status === "inactive" ? "User activated" : "User disabled"
            );
          },
        },
        {
          id: "reset-password",
          label: "Reset Password",
          onSelect: () => {
            const fd = new FormData();
            fd.set("user_id", user.id);
            runAction(() => resetPasswordAction(fd), "Password reset sent");
          },
        }
      );
    }
    if (canImpersonate) {
      actions.push({
        id: "impersonate",
        label: "View Activity / Impersonate",
        onSelect: () => {
          const fd = new FormData();
          fd.set("target_user_id", user.id);
          fd.set("reason", "Admin support session");
          runAction(() => startImpersonationAction(fd), "Impersonation started");
        },
      });
    }
    if (isFounder && canManage) {
      actions.push({
        id: "delete",
        label: "Delete",
        tone: "danger",
        onSelect: () => {
          if (!confirm(`Delete ${user.full_name ?? user.email}?`)) return;
          const fd = new FormData();
          fd.set("user_id", user.id);
          runAction(() => deleteUserAction(fd), "User deleted");
        },
      });
    }
    return actions;
  }

  function exportSelectedOrAll() {
    const rows = selected.length
      ? users.filter((u) => selected.includes(u.id))
      : filtered;
    const header = "Name,Email,Role,Schools,Department,Status,Last Login";
    const body = rows
      .map((u) =>
        [
          u.full_name ?? "",
          u.email,
          u.roles.join("; "),
          u.schools.join("; "),
          u.department ?? "",
          u.statusLabel,
          u.lastLogin ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    downloadText("users-export.csv", `${header}\n${body}\n`);
  }

  const showEmpty = users.length === 0;

  const toolbarBtn =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
  const toolbarBtnPrimary =
    "rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-4" data-testid="users-access-panel" data-users-ui="access-v2">
      {/* Toolbar is always rendered — manage actions disable when !canManage (never hide). */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Users & Access
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create users, send invitations, assign roles and schools during organization onboarding.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          data-testid="users-access-toolbar"
          role="toolbar"
          aria-label="User management actions"
        >
          <button
            type="button"
            disabled={!canManage}
            title={canManage ? undefined : "Requires users.manage"}
            onClick={() => setModal("add")}
            className={toolbarBtnPrimary}
          >
            + Add User
          </button>
          <button
            type="button"
            disabled={!canManage}
            title={canManage ? undefined : "Requires users.manage"}
            onClick={() => setModal("import")}
            className={toolbarBtn}
          >
            Import CSV
          </button>
          <button
            type="button"
            disabled={!canManage}
            title={canManage ? undefined : "Requires users.manage"}
            onClick={() => setModal("invite")}
            className={toolbarBtn}
          >
            Invite Users
          </button>
          <button
            type="button"
            onClick={exportSelectedOrAll}
            className={toolbarBtn}
          >
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search users"
          data-testid="users-access-search"
          className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        {canManage && selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">{selected.length} selected</span>
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={() => setModal("assign-school")}
            >
              Assign School
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={() => setModal("assign-role")}
            >
              Assign Role
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={() => {
                const fd = new FormData();
                selected.forEach((id) => fd.append("user_ids", id));
                runAction(() => bulkDeactivateAction(fd), "Users deactivated");
              }}
            >
              Deactivate
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={exportSelectedOrAll}>
              Export
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {showEmpty ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-base font-medium text-slate-900">No users have been added yet.</p>
          <p className="mt-2 text-sm text-slate-500">
            Start by inviting administrators, teachers, and staff.
          </p>
          {canManage && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setModal("add")}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              >
                Add User
              </button>
              <button
                type="button"
                onClick={() => setModal("import")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
              >
                Import CSV
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {canManage && <th className="px-3 py-3 w-10" />}
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Schools</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-t border-slate-100 align-top">
                  {canManage && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(user.id)}
                        onChange={(e) => {
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, user.id]
                              : prev.filter((id) => id !== user.id)
                          );
                        }}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div>{user.display_name?.trim() || user.full_name || "—"}</div>
                    {user.title?.trim() ? (
                      <div className="mt-0.5 text-xs font-normal text-slate-500">
                        {user.title}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <EmailLink email={user.email} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length
                        ? user.roles.map((r) => (
                            <span key={r} className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                              {r}
                            </span>
                          ))
                        : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {user.schools.length ? user.schools.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.department ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(user.status)}`}>
                      {user.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{user.lastLogin ?? "—"}</td>
                  <td className="px-4 py-3">
                    <EntityActionMenu
                      label="Actions"
                      ariaLabel={`Actions for ${user.full_name ?? user.email}`}
                      align="right"
                      actions={actionsForUser(user)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <p className="text-xs text-slate-500" aria-live="polite">
          Working…
        </p>
      )}

      {modal === "edit-profile" && actionUserId && (() => {
        const user = users.find((u) => u.id === actionUserId);
        if (!user) return null;
        const defaults = profileDefaults(user);
        return (
          <ModalShell title="Edit Profile" onClose={() => setModal(null)}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                runAction(() => updateUserProfileAction(fd), "Profile updated");
              }}
            >
              <input type="hidden" name="user_id" value={user.id} />
              <p className="text-sm text-slate-500">
                Updates profile display fields only. Roles and permissions are managed
                separately.
              </p>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {user.email}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  First Name
                  <input
                    name="first_name"
                    required
                    defaultValue={defaults.firstName}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Last Name
                  <input
                    name="last_name"
                    required
                    defaultValue={defaults.lastName}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
              <label className="block text-sm">
                Display Name
                <input
                  name="display_name"
                  required
                  defaultValue={defaults.displayName}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Job Title
                <input
                  name="title"
                  defaultValue={defaults.title}
                  placeholder="e.g. Chief Schools Officer"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </ModalShell>
        );
      })()}

      {modal === "add" && (
        <ModalShell title="Add User" onClose={() => setModal(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              runAction(() => createUserAction(fd), "User created");
            }}
          >
            <input type="hidden" name="organization_id" value={orgId} />
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Identity
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  First Name
                  <input name="first_name" required className="mt-1 w-full rounded border px-2 py-1.5" />
                </label>
                <label className="text-sm">
                  Last Name
                  <input name="last_name" required className="mt-1 w-full rounded border px-2 py-1.5" />
                </label>
              </div>
              <label className="block text-sm">
                Preferred Name
                <input name="preferred_name" className="mt-1 w-full rounded border px-2 py-1.5" />
              </label>
              <label className="block text-sm">
                Email
                <input name="email" type="email" required className="mt-1 w-full rounded border px-2 py-1.5" />
              </label>
              <label className="block text-sm">
                Phone
                <input name="phone" className="mt-1 w-full rounded border px-2 py-1.5" />
              </label>
            </fieldset>

            <label className="block text-sm">
              Organization
              <select name="organization_id_display" disabled className="mt-1 w-full rounded border px-2 py-1.5" value={orgId}>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="mb-1 text-sm">School</legend>
              <div className="max-h-36 space-y-1 overflow-auto rounded border p-2">
                {schools.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="school_ids" value={s.id} />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm">
              Role
              <select name="role" required className="mt-1 w-full rounded border px-2 py-1.5" defaultValue="ADMINISTRATOR">
                {USER_MANAGEMENT_ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Department
              <select name="department" className="mt-1 w-full rounded border px-2 py-1.5" defaultValue="">
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Manager
              <select name="manager_user_id" className="mt-1 w-full rounded border px-2 py-1.5" defaultValue="">
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ?? u.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Status
              <select name="status" className="mt-1 w-full rounded border px-2 py-1.5" defaultValue="active">
                {USER_MANAGEMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                Create User
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === "import" && (
        <ModalShell title="Import CSV" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Columns: First Name, Last Name, Email, Role, School, Department, Phone, Status
            </p>
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm"
              onClick={() => downloadText("users-template.csv", USER_CSV_TEMPLATE)}
            >
              Download Template
            </button>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={10}
              className="w-full rounded border px-2 py-1.5 font-mono text-xs"
              placeholder="Paste CSV contents…"
            />
            <label className="block text-sm">
              Or upload file
              <input
                type="file"
                accept=".csv,text/csv"
                className="mt-1 block w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void file.text().then(setCsvText);
                }}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("csv_text", csvText);
                  fd.set("organization_id", orgId);
                  fd.set("schools_json", JSON.stringify(schools));
                  runAction(() => importUsersCsvAction(fd), "CSV import complete");
                }}
              >
                Import
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {modal === "invite" && (
        <ModalShell title="Invite Users" onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              runAction(() => inviteUsersAction(fd), "Invitations sent");
            }}
          >
            <input type="hidden" name="organization_id" value={orgId} />
            <label className="block text-sm">
              Emails (one or many — comma or newline separated)
              <textarea name="emails" required rows={5} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-sm">
              Role
              <select name="role" required className="mt-1 w-full rounded border px-2 py-1.5" defaultValue="TEACHER">
                {USER_MANAGEMENT_ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="mb-1 text-sm">School</legend>
              <div className="max-h-36 space-y-1 overflow-auto rounded border p-2">
                {schools.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="school_ids" value={s.id} />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                Send invitation
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === "assign-role" && (
        <ModalShell title="Assign Role" onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if (actionUserId) {
                fd.set("user_id", actionUserId);
                fd.set("replace", "true");
                runAction(() => assignUserRoleAction(fd), "Role assigned");
              } else {
                selected.forEach((id) => fd.append("user_ids", id));
                runAction(() => bulkAssignRoleAction(fd), "Roles assigned");
              }
            }}
          >
            <label className="block text-sm">
              Role
              <select name="role" required className="mt-1 w-full rounded border px-2 py-1.5">
                {USER_MANAGEMENT_ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                Assign Role
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === "assign-school" && (
        <ModalShell title="Assign School" onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if (actionUserId) {
                fd.set("user_id", actionUserId);
                runAction(() => assignUserSchoolsAction(fd), "School assigned");
              } else {
                selected.forEach((id) => fd.append("user_ids", id));
                runAction(() => bulkAssignSchoolAction(fd), "Schools assigned");
              }
            }}
          >
            {actionUserId ? (
              <fieldset>
                <legend className="mb-1 text-sm">Schools</legend>
                <div className="max-h-48 space-y-1 overflow-auto rounded border p-2">
                  {schools.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="school_ids" value={s.id} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <label className="block text-sm">
                School
                <select name="school_id" required className="mt-1 w-full rounded border px-2 py-1.5">
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                Assign School
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
