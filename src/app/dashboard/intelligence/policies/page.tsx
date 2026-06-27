import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getPolicies, getKnowledgeSources } from "@/lib/intelligence-platform/policies-knowledge";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { HistoryTable } from "@/components/intelligence-platform/AipPanels";
import { createPolicyAction, registerKnowledgeAction } from "@/lib/intelligence-platform/actions";

export default async function PoliciesPage() {
  await requirePagePermission(["ai.manage", "ai.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [policies, sources] = orgId
    ? await Promise.all([getPolicies(supabase, orgId), getKnowledgeSources(supabase, orgId)])
    : [[], []];

  return (
    <AipShell title="AI Policies & Knowledge Registry" subtitle="Usage policies, FERPA rules, and future knowledge source registration">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={createPolicyAction} className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Policy name
            <input name="policy_name" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" defaultValue="FERPA Masking Policy" />
          </label>
          <input type="hidden" name="policy_key" value={`policy-${Date.now()}`} />
          <input type="hidden" name="policy_type" value="ferpa" />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create policy
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={registerKnowledgeAction} className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Source name
            <input name="source_name" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" defaultValue="Employee Handbook" />
          </label>
          <input type="hidden" name="source_key" value={`source-${Date.now()}`} />
          <input type="hidden" name="source_type" value="hr_manual" />
          <button type="submit" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Register source
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Policies</h2>
        <HistoryTable rows={policies} columns={[{ key: "policy_name", label: "Name" }, { key: "policy_type", label: "Type" }, { key: "is_active", label: "Active" }]} />
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Knowledge sources</h2>
        <HistoryTable rows={sources} columns={[{ key: "source_name", label: "Name" }, { key: "source_type", label: "Type" }, { key: "classification", label: "Classification" }]} />
      </section>
    </AipShell>
  );
}
