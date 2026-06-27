import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { getParticipationSettings } from "@/lib/intelligence-network/participation";
import { AinShell } from "@/components/intelligence-network/AinNav";
import { PrivacyNotice } from "@/components/intelligence-network/AinPanels";
import { updateParticipationAction } from "@/lib/intelligence-network/actions";
import { DATA_CATEGORIES, PEER_SEGMENTS } from "@/lib/intelligence-network/types";

export default async function NetworkSettingsPage() {
  await requirePagePermission(["network.manage", "network.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const settings = await getParticipationSettings(supabase, orgId);

  return (
    <AinShell title="Network Participation Settings" subtitle="Opt in, opt out, selective participation, anonymization, regional/national/international sharing">
      <PrivacyNotice />
      <form action={updateParticipationAction} className="space-y-4 rounded-xl border bg-white p-6">
        <div>
          <label className="text-sm font-medium">Participation</label>
          <select name="participation_status" defaultValue={settings?.participation_status ?? "opt_out"} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm">
            <option value="opt_out">Opt Out</option>
            <option value="opt_in">Opt In</option>
            <option value="selective">Selective Participation</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Anonymization Level</label>
          <select name="anonymization_level" defaultValue={settings?.anonymization_level ?? "standard"} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm">
            <option value="standard">Standard</option>
            <option value="enhanced">Enhanced</option>
            <option value="minimal">Minimal (most aggregated)</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="share_regional" defaultChecked={settings?.share_regional ?? true} /> Regional sharing</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="share_national" defaultChecked={settings?.share_national ?? true} /> National sharing</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="share_international" defaultChecked={settings?.share_international ?? false} /> International sharing</label>
        </div>
        <div>
          <p className="text-sm font-medium">Data Sharing Categories</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {DATA_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input type="checkbox" name="data_categories" value={c} defaultChecked={(settings?.data_categories as string[] | undefined)?.includes(c) ?? true} />
                {c}
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">Peer segments: {PEER_SEGMENTS.map((s) => s.label).join(", ")}</p>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Save consent & settings</button>
      </form>
      {settings?.consent_at && <p className="text-xs text-slate-500">Consent recorded: {settings.consent_at}</p>}
    </AinShell>
  );
}
