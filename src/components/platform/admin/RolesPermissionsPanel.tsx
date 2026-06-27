"use client";

import { useState, useTransition } from "react";
import { toggleRolePermissionAction, createCustomRoleAction } from "@/lib/platform/identity/server-actions";

interface RolesPermissionsPanelProps {
  roles: Array<{
    id: string;
    name: string;
    display_name: string | null;
    description: string | null;
    is_custom: boolean;
    is_system: boolean;
  }>;
  permissions: Array<{
    permission_key: string;
    name: string;
    module: string;
    category: string;
  }>;
  rolePermissions: Array<{ role_id: string; permission_key: string; effect: string }>;
}

export function RolesPermissionsPanel({
  roles,
  permissions,
  rolePermissions,
}: RolesPermissionsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "");

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const rolePermSet = new Set(
    rolePermissions
      .filter((rp) => rp.role_id === selectedRoleId && rp.effect === "allow")
      .map((rp) => rp.permission_key)
  );

  const grouped = permissions.reduce<Record<string, typeof permissions>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <div className="space-y-2 lg:col-span-1">
        <h3 className="text-sm font-semibold text-slate-900">Roles</h3>
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedRoleId(role.id)}
            className={`block w-full rounded-xl border px-4 py-3 text-left text-sm ${
              selectedRoleId === role.id
                ? "border-brand-300 bg-brand-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <span className="font-medium text-slate-900">{role.display_name ?? role.name}</span>
            {role.is_custom && (
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                Custom
              </span>
            )}
          </button>
        ))}

        <form
          className="mt-4 space-y-2 rounded-xl border border-dashed border-slate-300 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => {
              void createCustomRoleAction(fd);
            });
          }}
        >
          <p className="text-xs font-semibold uppercase text-slate-500">Create custom role</p>
          <input name="display_name" placeholder="Display name" required className="w-full rounded-lg border px-3 py-2 text-sm" />
          <input name="name" placeholder="ROLE_KEY" required className="w-full rounded-lg border px-3 py-2 text-sm" />
          <select name="parent_role" className="w-full rounded-lg border px-3 py-2 text-sm">
            <option value="">No parent (inherit nothing)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                Inherit from {r.display_name ?? r.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Create role
          </button>
        </form>
      </div>

      <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900">
          Permissions — {selectedRole?.display_name ?? selectedRole?.name}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Allow/deny with inheritance from parent roles. Deny overrides allow.
        </p>
        <div className="mt-4 space-y-6">
          {Object.entries(grouped).map(([module, perms]) => (
            <div key={module}>
              <p className="text-xs font-semibold uppercase text-slate-400">{module}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {perms.map((perm) => {
                  const enabled = rolePermSet.has(perm.permission_key);
                  return (
                    <label
                      key={perm.permission_key}
                      className="flex items-start gap-3 rounded-lg border border-slate-100 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={isPending || selectedRole?.name === "CEO" || selectedRole?.name === "FOUNDER"}
                        onChange={() => {
                          startTransition(async () => {
                            const fd = new FormData();
                            fd.set("role_id", selectedRoleId);
                            fd.set("permission_key", perm.permission_key);
                            fd.set("enabled", String(!enabled));
                            await toggleRolePermissionAction(fd);
                          });
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{perm.name}</span>
                        <span className="text-xs text-slate-500">{perm.permission_key}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
