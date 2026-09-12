import { OrgAdminShell, RoleBadge } from "@/components/organization-platform/OrgAdminShell";
import { getOrganizationPlatform } from "@/lib/platform/organization-platform";
import { EmailLink } from "@/components/platform/contact/ContactLink";

export const metadata = {
  title: "Users · Organization Platform · JAG",
};

export default async function UsersPage() {
  const platform = getOrganizationPlatform();
  const users = platform.store.listUsers();

  return (
    <OrgAdminShell
      title="Users"
      subtitle="Invites, roles, location/department assignment, sessions"
      activeHref="/users"
    >
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Auth</th>
              <th className="px-4 py-3 font-medium">Organizations</th>
              <th className="px-4 py-3 font-medium">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const memberships = platform.store.membershipsForUser(user.id);
              const sessions = platform.sessions.listForUser(user.id);
              return (
                <tr key={user.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{user.fullName}</p>
                    <p className="text-xs text-slate-500">
                      <EmailLink email={user.email} />
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.authMethods.map((m) => (
                        <span
                          key={m}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1">
                      {memberships.map((m) => {
                        const org = platform.store.organizations.get(m.organizationId);
                        return (
                          <li key={m.id} className="flex flex-wrap items-center gap-2">
                            <span className="text-slate-700">{org?.name ?? m.organizationId}</span>
                            <RoleBadge role={m.role} />
                            <span className="text-xs text-slate-400">{m.status}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{sessions.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </OrgAdminShell>
  );
}
