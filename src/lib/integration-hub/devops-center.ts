import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getSandboxKeys, getUsageAnalytics } from "@/lib/integration-hub/developer-portal";
import { getApiAuditLog } from "@/lib/integration-hub/api-gateway";
import { getWorkflowAnalytics } from "@/lib/integration-hub/automation-studio";
import { getConnectorCertifications } from "@/lib/integration-hub/connector-certification";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getDevOpsDashboard(supabase: AuthClient, organizationId: string) {
  const [usage, audit, workflows, certifications, sandbox] = await Promise.all([
    getUsageAnalytics(supabase, organizationId),
    getApiAuditLog(supabase, organizationId, 10),
    getWorkflowAnalytics(supabase, organizationId),
    getConnectorCertifications(supabase),
    getSandboxKeys(supabase, organizationId),
  ]);

  return {
    usage,
    recentApiCalls: audit.length,
    workflowSuccessRate: workflows.successRate,
    certifiedConnectors: certifications.filter((c) => c.certification_status === "certified").length,
    sandboxKeys: sandbox.length,
    openApiUrl: "/api/integrations/docs",
  };
}
