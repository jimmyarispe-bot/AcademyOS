import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getOrgSettings, getModuleSettings } from "@/lib/intelligence-platform/settings";
import { getProviderDefinitions } from "@/lib/intelligence-platform/provider-abstraction";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { saveSettingsAction, saveModuleSettingsAction } from "@/lib/intelligence-platform/actions";

export default async function SettingsPage() {
  await requirePagePermission(["ai.admin", "ai.manage"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [settings, moduleSettings, providers] = orgId
    ? await Promise.all([
        getOrgSettings(supabase, orgId),
        getModuleSettings(supabase, orgId),
        getProviderDefinitions(supabase),
      ])
    : [null, [], []];

  return (
    <AipShell title="AI Settings" subtitle="Organization, school, and module-level AI configuration">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">Organization settings</h2>
        <form action={saveSettingsAction} className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ai_enabled" value="true" defaultChecked={settings?.ai_enabled} />
            AI enabled (architecture ready)
          </label>
          <label className="block text-sm">
            Default provider
            <select name="default_provider_key" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" defaultValue={settings?.default_provider_key ?? ""}>
              <option value="">None</option>
              {providers.map((p) => (
                <option key={p.provider_key} value={p.provider_key}>{p.display_name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="require_human_review" value="true" defaultChecked={settings?.require_human_review ?? true} />
            Require human review
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ferpa_masking_enabled" value="true" defaultChecked={settings?.ferpa_masking_enabled ?? true} />
            FERPA masking enabled
          </label>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save organization settings
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">Module settings</h2>
        <form action={saveModuleSettingsAction} className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Module
            <select name="module_key" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2">
              <option value="admissions">Admissions</option>
              <option value="finance">Finance</option>
              <option value="executive">Executive</option>
              <option value="hr">HR</option>
              <option value="ssis">SSIS</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ai_enabled" value="true" />
            Enabled
          </label>
          <button type="submit" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Save module
          </button>
        </form>
        {moduleSettings.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-slate-600">
            {moduleSettings.map((m) => (
              <li key={m.id}>{m.module_key}: {m.ai_enabled ? "enabled" : "disabled"}</li>
            ))}
          </ul>
        )}
      </section>
    </AipShell>
  );
}
