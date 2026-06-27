import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { loadConfigPage } from "@/lib/configuration/page-data";
import { getOrganizationHierarchy } from "@/lib/platform/identity/org";
import Link from "next/link";

export default async function CampusesConfigPage() {
  await loadConfigPage();
  const hierarchy = await getOrganizationHierarchy();

  return (
    <ConfigStudioShell title="Campuses" subtitle="Configure campuses across your organization">
      <ul className="space-y-2">
        {hierarchy.campuses.map((c) => (
          <li key={c.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <span className="font-medium">{c.name}</span>
            <span className="ml-2 text-slate-500">({c.code}) — {c.status}</span>
          </li>
        ))}
        {!hierarchy.campuses.length && <li className="text-slate-500">No campuses yet. Add via organization hierarchy.</li>}
      </ul>
      <Link href="/dashboard/admin/organization" className="inline-block text-sm text-brand-600 hover:underline">
        Manage in organization hierarchy →
      </Link>
    </ConfigStudioShell>
  );
}
