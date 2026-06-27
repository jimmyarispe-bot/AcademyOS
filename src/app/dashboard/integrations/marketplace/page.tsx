import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getMarketplaceListings, getPendingApprovals } from "@/lib/integration-hub/marketplace";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";
import { installMarketplaceAction } from "@/lib/integration-hub/actions";

export default async function IntegrationMarketplacePage() {
  await requirePagePermission(["integration.marketplace", "integration.view", "integration.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [listings, pending] = await Promise.all([
    getMarketplaceListings(supabase),
    getPendingApprovals(supabase),
  ]);

  return (
    <IntHubShell title="Integration Marketplace" subtitle="Install, update, disable connectors — licensing, ratings, reviews, version history, revenue sharing">
      <IntHubTable rows={listings} columns={[
        { key: "listing_name", label: "Connector" }, { key: "version", label: "Version" },
        { key: "certification_status", label: "Certified" }, { key: "average_rating", label: "Rating" },
        { key: "revenue_share_pct", label: "Rev Share %" },
      ]} />
      {listings.slice(0, 3).map((l) => (
        <form key={l.id} action={installMarketplaceAction} className="flex flex-wrap gap-2 rounded-lg border bg-white p-3 text-sm">
          <input type="hidden" name="listing_id" value={l.id} />
          <input type="hidden" name="connector_key" value={l.connector_key ?? ""} />
          <input name="instance_name" placeholder={`Install ${l.listing_name}`} className="rounded border px-2 py-1" required />
          <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-white">Install</button>
        </form>
      ))}
      {pending.length > 0 && (
        <>
          <h2 className="font-semibold">Pending Approval</h2>
          <IntHubTable rows={pending} columns={[{ key: "listing_name", label: "Listing" }, { key: "approval_status", label: "Status" }]} />
        </>
      )}
      {!orgId && <p className="text-sm text-slate-500">Organization required for marketplace installs.</p>}
    </IntHubShell>
  );
}
