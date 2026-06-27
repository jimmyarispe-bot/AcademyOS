import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getConnectorCertifications(supabase: AuthClient) {
  const { data } = await supabase
    .from("ihub_connector_certifications")
    .select("*, edp_connector_definitions(display_name, category)")
    .order("reliability_score", { ascending: false });
  return data ?? [];
}

export async function getCertificationForConnector(supabase: AuthClient, connectorKey: string) {
  const { data } = await supabase
    .from("ihub_connector_certifications")
    .select("*")
    .eq("connector_key", connectorKey)
    .maybeSingle();
  return data;
}

export async function certifyConnector(
  supabase: AuthClient,
  connectorKey: string,
  scores: { reliability: number; security: number; performance: number }
) {
  const overall = (scores.reliability + scores.security + scores.performance) / 3;
  const status = overall >= 95 ? "certified" : overall >= 85 ? "verified" : "preview";

  await supabase.from("ihub_connector_certifications").upsert({
    connector_key: connectorKey,
    certification_status: status,
    reliability_score: scores.reliability,
    security_score: scores.security,
    performance_score: scores.performance,
    health_rating: overall / 20,
    updated_at: new Date().toISOString(),
  }, { onConflict: "connector_key" });
}
