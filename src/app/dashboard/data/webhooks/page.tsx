import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { listWebhooks } from "@/lib/enterprise-data/webhook-services";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { createWebhookAction, testWebhookAction } from "@/lib/enterprise-data/actions";

export default async function DataWebhooksPage() {
  await requirePagePermission(["data.manage", "data.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const webhooks = orgId ? await listWebhooks(supabase, orgId) : [];

  return (
    <EdpShell title="Webhook Center" subtitle="Incoming and outgoing webhooks with retry policies, signing, and testing console">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={createWebhookAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Name
              <input name="webhook_name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" defaultValue="Student Events" />
            </label>
            <label className="block text-sm">
              Direction
              <select name="direction" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                <option value="outgoing">Outgoing</option>
                <option value="incoming">Incoming</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Endpoint URL
            <input name="endpoint_url" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="https://..." />
          </label>
          <input type="hidden" name="event_types" value='["student.enrolled","student.updated"]' />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create webhook
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Configured webhooks</h2>
        <ul className="space-y-2">
          {webhooks.map((w) => (
            <li key={w.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <div>
                <span className="font-medium">{w.webhook_name}</span>
                <span className="ml-2 capitalize text-slate-500">{w.direction}</span>
              </div>
              <form action={testWebhookAction}>
                <input type="hidden" name="webhook_id" value={w.id} />
                <button type="submit" className="text-brand-600 hover:underline">Test</button>
              </form>
            </li>
          ))}
          {!webhooks.length && <li className="text-slate-500">No webhooks configured.</li>}
        </ul>
      </section>
    </EdpShell>
  );
}
