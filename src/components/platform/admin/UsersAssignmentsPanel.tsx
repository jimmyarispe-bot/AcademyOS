"use client";

import { useTransition } from "react";
import {
  assignUserOrgScopeAction,
  startImpersonationAction,
} from "@/lib/platform/identity/server-actions";

interface UsersAssignmentsPanelProps {
  users: Array<{
    id: string;
    email: string;
    full_name: string | null;
    roles: string[];
    schools: string[];
  }>;
  schools: Array<{ id: string; name: string }>;
  canManage: boolean;
  canImpersonate: boolean;
}

export function UsersAssignmentsPanel({
  users,
  schools,
  canManage,
  canImpersonate,
}: UsersAssignmentsPanelProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Roles</th>
            <th className="px-4 py-3">School access</th>
            {canManage && <th className="px-4 py-3">Assign school</th>}
            {canImpersonate && <th className="px-4 py-3">Act as</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-slate-100 align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{user.full_name ?? "—"}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((r) => (
                    <span key={r} className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                      {r}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {user.schools.length ? user.schools.join(", ") : "All schools (enterprise)"}
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(() => {
                        void assignUserOrgScopeAction(fd);
                      });
                    }}
                  >
                    <input type="hidden" name="user_id" value={user.id} />
                    <select name="school_id" className="rounded border px-2 py-1 text-xs">
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input type="hidden" name="all_campuses" value="true" />
                    <input type="hidden" name="all_programs" value="true" />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </form>
                </td>
              )}
              {canImpersonate && (
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(() => {
                        const fd = new FormData();
                        fd.set("target_user_id", user.id);
                        fd.set("reason", "Admin support session");
                        void startImpersonationAction(fd);
                      });
                    }}
                    className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
                  >
                    Impersonate
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
