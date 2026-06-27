import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getPrompts } from "@/lib/intelligence-platform/prompt-registry";
import { getProviderDefinitions } from "@/lib/intelligence-platform/provider-abstraction";
import { getTestRuns } from "@/lib/intelligence-platform/testing-lab";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { HistoryTable } from "@/components/intelligence-platform/AipPanels";
import { runTestAction } from "@/lib/intelligence-platform/actions";

export default async function TestingPage() {
  await requirePagePermission(["ai.testing", "ai.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [prompts, providers, tests] = orgId
    ? await Promise.all([
        getPrompts(supabase, orgId),
        getProviderDefinitions(supabase),
        getTestRuns(supabase, orgId),
      ])
    : [[], [], []];

  return (
    <AipShell title="Prompt Testing Lab" subtitle="Test prompts, compare versions and providers, measure latency and token usage">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={runTestAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Prompt
              <select name="prompt_id" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                <option value="">None</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Provider
              <select name="provider_key" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                {providers.map((p) => (
                  <option key={p.provider_key} value={p.provider_key}>{p.display_name}</option>
                ))}
              </select>
            </label>
          </div>
          <input type="hidden" name="test_input" value='{"sample":"test input"}' />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Run simulated test
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Test runs</h2>
        <HistoryTable
          rows={tests}
          columns={[
            { key: "provider_key", label: "Provider" },
            { key: "latency_ms", label: "Latency (ms)" },
            { key: "tokens_in", label: "Tokens in" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "When" },
          ]}
        />
      </section>
    </AipShell>
  );
}
