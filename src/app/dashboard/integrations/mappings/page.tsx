import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getMappingProfiles } from "@/lib/integration-hub/mapping-studio";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";
import { createMappingProfileAction } from "@/lib/integration-hub/actions";

export default async function IntegrationMappingsPage() {
  await requirePagePermission(["integration.view", "integration.manage", "integration.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const profiles = await getMappingProfiles(supabase, orgId);

  return (
    <IntHubShell title="Data Mapping Studio" subtitle="Visual field mapping — transformations, lookup tables, defaults, conditional mappings, validation, preview, templates">
      <form action={createMappingProfileAction} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <input name="profile_name" placeholder="Profile name" className="rounded-lg border px-3 py-2 text-sm" required />
        <input name="source_entity" placeholder="Source entity" className="rounded-lg border px-3 py-2 text-sm" required />
        <input name="target_entity" placeholder="Target entity" className="rounded-lg border px-3 py-2 text-sm" required />
        <input name="connector_key" placeholder="Connector key (optional)" className="rounded-lg border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create profile</button>
      </form>
      <IntHubTable rows={profiles} columns={[
        { key: "profile_name", label: "Profile" }, { key: "source_entity", label: "Source" },
        { key: "target_entity", label: "Target" }, { key: "connector_key", label: "Connector" },
      ]} />
    </IntHubShell>
  );
}
