import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getProviderDefinitions, getProviderInstances, PROVIDER_ADAPTER_ARCHITECTURE } from "@/lib/intelligence-platform/provider-abstraction";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { createProviderAction } from "@/lib/intelligence-platform/actions";

export default async function ProvidersPage() {
  await requirePagePermission(["ai.providers", "ai.admin", "ai.view"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [definitions, instances] = orgId
    ? await Promise.all([getProviderDefinitions(supabase), getProviderInstances(supabase, orgId)])
    : [[], []];

  return (
    <AipShell title="Provider Abstraction" subtitle="Adapter registry for OpenAI, Anthropic, Gemini, Azure, Bedrock, and local LLMs">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <p className="text-slate-600">Supported adapters: {PROVIDER_ADAPTER_ARCHITECTURE.adapters.join(", ")}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {definitions.map((d) => (
          <div key={d.provider_key} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-medium">{d.display_name}</p>
            <p className="text-slate-500">{d.auth_type}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={createProviderAction} className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Provider
            <select name="provider_key" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2">
              {definitions.map((d) => (
                <option key={d.provider_key} value={d.provider_key}>{d.display_name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Instance name
            <input name="instance_name" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" defaultValue="Primary" />
          </label>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Register instance
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Configured instances</h2>
        <ul className="space-y-2 text-sm">
          {instances.map((i) => (
            <li key={i.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              {i.instance_name} — {i.provider_key} ({i.health_status})
            </li>
          ))}
          {!instances.length && <li className="text-slate-500">No provider instances configured.</li>}
        </ul>
      </section>
    </AipShell>
  );
}
