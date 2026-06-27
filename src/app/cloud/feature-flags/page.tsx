import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getFeatureFlags } from "@/lib/cloud-platform/releases";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { toggleFeatureFlagAction } from "@/lib/cloud-platform/actions";

export default async function CloudFeatureFlagsPage() {
  await requireCloudPermission(["cloud.admin", "cloud.engineering"]);
  const supabase = await createAuthClient();
  const flags = await getFeatureFlags(supabase);

  return (
    <CloudShell title="Feature Flags" subtitle="Organization, school, subscription, beta, internal, and A/B ready">
      <form action={toggleFeatureFlagAction} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <input name="flag_key" placeholder="flag_key" className="rounded-lg border px-3 py-2 text-sm" required />
        <input name="display_name" placeholder="Display name" className="rounded-lg border px-3 py-2 text-sm" required />
        <input type="hidden" name="is_enabled" value="true" />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create flag</button>
      </form>
      <CloudTable rows={flags} columns={[
        { key: "flag_key", label: "Key" }, { key: "scope_type", label: "Scope" },
        { key: "is_enabled", label: "Enabled" }, { key: "is_beta", label: "Beta" },
      ]} />
    </CloudShell>
  );
}
