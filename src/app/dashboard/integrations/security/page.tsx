import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getCredentials, getExpiringCredentials, getSecurityAuditSummary } from "@/lib/integration-hub/credential-vault";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";
import { rotateCredentialAction } from "@/lib/integration-hub/actions";

export default async function IntegrationSecurityPage() {
  await requirePagePermission(["integration.admin", "integration.manage"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const [credentials, expiring, audit] = await Promise.all([
    getCredentials(supabase, orgId),
    getExpiringCredentials(supabase, orgId),
    getSecurityAuditSummary(supabase, orgId),
  ]);

  return (
    <IntHubShell title="Integration Security" subtitle="Encrypted credentials, secret rotation, credential vault, scoped tokens, API key rotation, certificate management, audit logging">
      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-xl border bg-white p-4"><p className="text-slate-500">Credentials</p><p className="text-2xl font-bold">{audit.credentialCount}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-slate-500">API Audit Entries</p><p className="text-2xl font-bold">{audit.apiAuditCount}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-slate-500">Expiring Soon</p><p className="text-2xl font-bold">{audit.expiringCredentials}</p></div>
      </div>
      <p className="text-sm text-slate-600">{audit.tenantIsolation}</p>
      <form action={rotateCredentialAction} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <input name="vault_key" placeholder="Vault key" className="rounded-lg border px-3 py-2 text-sm" required />
        <select name="credential_type" className="rounded-lg border px-3 py-2 text-sm">
          <option value="api_key">API Key</option>
          <option value="oauth">OAuth</option>
          <option value="webhook_secret">Webhook Secret</option>
          <option value="certificate">Certificate</option>
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Rotate credential</button>
      </form>
      <IntHubTable rows={credentials} columns={[
        { key: "vault_key", label: "Key" }, { key: "credential_type", label: "Type" },
        { key: "rotation_due_at", label: "Rotation Due" }, { key: "is_active", label: "Active" },
      ]} />
      {expiring.length > 0 && (
        <>
          <h2 className="font-semibold text-amber-700">Credentials Requiring Rotation</h2>
          <IntHubTable rows={expiring} columns={[{ key: "vault_key", label: "Key" }, { key: "rotation_due_at", label: "Due" }]} />
        </>
      )}
    </IntHubShell>
  );
}
