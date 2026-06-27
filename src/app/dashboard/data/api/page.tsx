import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { listApiKeys, API_PLATFORM_ARCHITECTURE } from "@/lib/enterprise-data/api-services";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { createApiKeyAction, revokeApiKeyAction } from "@/lib/enterprise-data/actions";

export default async function DataApiPage() {
  await requirePagePermission(["data.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const keys = orgId ? await listApiKeys(supabase, orgId) : [];

  return (
    <EdpShell title="API Management" subtitle="Secure REST APIs — keys, scopes, rate limiting, audit logging, versioning">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">Platform architecture</h2>
        <ul className="mt-2 space-y-1 text-slate-600">
          <li>Version: {API_PLATFORM_ARCHITECTURE.versioning}</li>
          <li>Auth: {API_PLATFORM_ARCHITECTURE.authMethods.join(", ")}</li>
          <li>Rate limiting: {API_PLATFORM_ARCHITECTURE.rateLimiting}</li>
          <li>Scopes: {API_PLATFORM_ARCHITECTURE.scopes.join(", ")}</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={createApiKeyAction} className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Key name
            <input name="key_name" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" defaultValue="Integration Key" />
          </label>
          <input type="hidden" name="scopes" value='["read","students"]' />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Generate API key
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Active keys</h2>
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <div>
                <span className="font-medium">{k.key_name}</span>
                <span className="ml-2 text-slate-500">{k.key_prefix}…</span>
                {!k.is_active && <span className="ml-2 text-red-600">Revoked</span>}
              </div>
              {k.is_active && (
                <form action={revokeApiKeyAction}>
                  <input type="hidden" name="key_id" value={k.id} />
                  <button type="submit" className="text-red-600 hover:underline">Revoke</button>
                </form>
              )}
            </li>
          ))}
          {!keys.length && <li className="text-slate-500">No API keys yet.</li>}
        </ul>
      </section>
    </EdpShell>
  );
}
