import type { createAuthClient } from "@/lib/supabase/server-auth";
import { TESTING_LAB_SCENARIOS } from "@/lib/integration-hub/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export function getTestingScenarios() {
  return TESTING_LAB_SCENARIOS;
}

export async function runLabTest(
  supabase: AuthClient,
  input: { organizationId: string; scenario: string; actorId?: string }
) {
  const start = Date.now();
  let status = "pass";
  let message = `${input.scenario} test completed`;

  if (input.scenario === "webhook_delivery") {
    const { count } = await supabase.from("edp_webhooks").select("id", { count: "exact", head: true }).eq("organization_id", input.organizationId);
    if (!count) { status = "warning"; message = "No webhooks configured"; }
  }
  if (input.scenario === "connector_health") {
    const { data } = await supabase.from("edp_connector_instances").select("health_status").eq("organization_id", input.organizationId).limit(5);
    const unhealthy = (data ?? []).filter((d) => d.health_status === "unhealthy").length;
    if (unhealthy) { status = "warning"; message = `${unhealthy} unhealthy connectors`; }
  }

  await supabase.from("ihub_api_audit_log").insert({
    organization_id: input.organizationId,
    method: "TEST",
    path: `/testing-lab/${input.scenario}`,
    auth_type: "sandbox",
    status_code: status === "pass" ? 200 : 207,
    latency_ms: Date.now() - start,
    actor_id: input.actorId ?? null,
  });

  return { scenario: input.scenario, status, message, latencyMs: Date.now() - start };
}
