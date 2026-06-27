import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { CloudHubSummary } from "@/lib/cloud-platform/types";
import { getMrr } from "@/lib/cloud-platform/subscriptions";
import { capturePlatformHealth } from "@/lib/cloud-platform/monitoring";
import { computeCustomerSuccessSnapshot } from "@/lib/cloud-platform/customer-success";
import { captureUsageAnalytics, recordProductAnalytics } from "@/lib/cloud-platform/analytics";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getCloudHubSummary(supabase: AuthClient): Promise<CloudHubSummary> {
  const [customers, subscriptions, tickets, incidents, mrr, atRisk] = await Promise.all([
    supabase.from("cloud_customers").select("id", { count: "exact", head: true }),
    supabase.from("cloud_subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trial"]),
    supabase.from("cloud_support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("cloud_incidents").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    getMrr(supabase),
    supabase.from("cloud_customers").select("id", { count: "exact", head: true }).in("risk_level", ["high", "critical"]),
  ]);

  return {
    totalCustomers: customers.count ?? 0,
    activeSubscriptions: subscriptions.count ?? 0,
    openTickets: tickets.count ?? 0,
    openIncidents: incidents.count ?? 0,
    mrr,
    atRiskCustomers: atRisk.count ?? 0,
  };
}

export async function syncCloudPlatform(supabase: AuthClient) {
  await capturePlatformHealth(supabase);
  await recordProductAnalytics(supabase);

  const { data: customers } = await supabase.from("cloud_customers").select("id").limit(50);
  for (const c of customers ?? []) {
    await computeCustomerSuccessSnapshot(supabase, c.id);
    await captureUsageAnalytics(supabase, c.id);
  }

  const { data: criticalCustomers } = await supabase
    .from("cloud_customers")
    .select("id, customer_name")
    .in("risk_level", ["high", "critical"])
    .limit(5);

  for (const customer of criticalCustomers ?? []) {
    const { data: existing } = await supabase
      .from("platform_mission_control_items")
      .select("id")
      .eq("entity_type", "cloud_customers")
      .eq("entity_id", customer.id)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existing) continue;

    const { data: school } = await supabase.from("schools").select("id").limit(1).maybeSingle();

    await createMissionControlItem(supabase, {
      schoolId: school?.id ?? "",
      module: "mission_control",
      itemType: "executive_alert",
      title: `At-risk customer: ${customer.customer_name}`,
      body: "Review in Cloud Console Customer Success",
      href: "/cloud/customer-success",
      entityType: "cloud_customers",
      entityId: customer.id,
      assignedRole: "CEO",
      severity: "high",
    });
  }
}
