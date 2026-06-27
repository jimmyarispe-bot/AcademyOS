import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getMarketplaceListings(supabase: AuthClient) {
  const { data } = await supabase
    .from("ihub_marketplace_listings")
    .select("*")
    .in("approval_status", ["approved", "submitted"])
    .order("average_rating", { ascending: false });
  return data ?? [];
}

export async function getMarketplaceReviews(supabase: AuthClient, listingId: string) {
  const { data } = await supabase
    .from("ihub_marketplace_reviews")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function installMarketplaceConnector(
  supabase: AuthClient,
  input: { organizationId: string; listingId: string; connectorKey: string; instanceName: string }
) {
  const { data: listing } = await supabase.from("ihub_marketplace_listings").select("*").eq("id", input.listingId).single();
  if (!listing || listing.approval_status !== "approved") return { error: "Listing not approved" };

  const { data, error } = await supabase
    .from("edp_connector_instances")
    .insert({
      organization_id: input.organizationId,
      connector_key: input.connectorKey,
      instance_name: input.instanceName,
      status: "pending_auth",
      sync_direction: "bidirectional",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("ihub_integration_registry").upsert({
    organization_id: input.organizationId,
    integration_key: input.connectorKey,
    integration_name: listing.listing_name,
    integration_type: "connector",
    connector_instance_id: data.id,
    status: "pending",
    metadata: { marketplaceListingId: input.listingId, version: listing.version },
  }, { onConflict: "organization_id,integration_key" });

  return { instanceId: data.id };
}

export async function disableMarketplaceConnector(supabase: AuthClient, organizationId: string, integrationKey: string) {
  await supabase.from("ihub_integration_registry").update({ status: "disabled" }).eq("organization_id", organizationId).eq("integration_key", integrationKey);
  await supabase.from("edp_connector_instances").update({ status: "inactive" }).eq("organization_id", organizationId).eq("connector_key", integrationKey);
}

export async function submitMarketplaceListing(
  supabase: AuthClient,
  input: { publisherOrgId: string; listingKey: string; listingName: string; description?: string; connectorKey?: string }
) {
  const { data, error } = await supabase
    .from("ihub_marketplace_listings")
    .insert({
      publisher_org_id: input.publisherOrgId,
      listing_key: input.listingKey,
      listing_name: input.listingName,
      description: input.description ?? null,
      connector_key: input.connectorKey ?? null,
      approval_status: "submitted",
      certification_status: "pending",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { listingId: data.id };
}

export async function getPendingApprovals(supabase: AuthClient) {
  const { data } = await supabase
    .from("ihub_marketplace_listings")
    .select("*")
    .in("approval_status", ["submitted", "draft"])
    .order("created_at", { ascending: false });
  return data ?? [];
}
