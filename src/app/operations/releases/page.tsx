import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getReleases, getFeatureFlags } from "@/lib/cloud-platform/releases";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsReleasesPage() {
  await requireOperationsPermission(["operations.manage"]);
  const supabase = await createAuthClient();
  const [releases, flags] = await Promise.all([getReleases(supabase), getFeatureFlags(supabase)]);

  return (
    <OpsShell title="Release Management" subtitle="Release history, feature flags, and rollout status">
      <h2 className="font-semibold">Releases</h2>
      <OpsTable rows={releases} columns={[
        { key: "release_version", label: "Version" }, { key: "release_type", label: "Type" },
        { key: "status", label: "Status" },
      ]} />
      <h2 className="font-semibold">Feature Flags</h2>
      <OpsTable rows={flags} columns={[
        { key: "flag_key", label: "Flag" }, { key: "display_name", label: "Name" },
        { key: "is_enabled", label: "Enabled" }, { key: "scope_type", label: "Scope" },
      ]} />
    </OpsShell>
  );
}
