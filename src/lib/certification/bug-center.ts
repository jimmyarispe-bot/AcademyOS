import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getPrimaryOrganizationId } from "@/lib/certification/context";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getBugs(supabase: AuthClient, organizationId?: string | null) {
  let query = supabase.from("cert_bugs").select("*").order("created_at", { ascending: false }).limit(50);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data } = await query;
  return data ?? [];
}

export async function getBugSummary(supabase: AuthClient) {
  const bugs = await getBugs(supabase);
  return {
    open: bugs.filter((b) => b.status === "open").length,
    regression: bugs.filter((b) => b.status === "regression").length,
    resolved: bugs.filter((b) => b.status === "resolved").length,
    verified: bugs.filter((b) => b.verification_status === "verified").length,
    critical: bugs.filter((b) => b.severity === "critical" && b.status !== "resolved").length,
    total: bugs.length,
  };
}

export async function seedBugTrackerIfEmpty(supabase: AuthClient) {
  const { count } = await supabase.from("cert_bugs").select("id", { count: "exact", head: true });
  if (count) return;

  const orgId = await getPrimaryOrganizationId(supabase);
  await supabase.from("cert_bugs").insert([
    { organization_id: orgId, title: "Mobile table overflow on finance dashboard", severity: "medium", status: "open", affected_module: "finance", assigned_engineer: "platform-team" },
    { organization_id: orgId, title: "Webhook retry delay regression", severity: "high", status: "regression", affected_module: "enterprise_data", assigned_engineer: "integrations-team", release_fixed: "v0.9.8" },
    { organization_id: orgId, title: "Certification readiness snapshot timezone", severity: "low", status: "resolved", affected_module: "certification", verification_status: "verified", release_fixed: "v1.0-rc1" },
  ]);
}
