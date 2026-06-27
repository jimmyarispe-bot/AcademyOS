import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { OperationsHubSummary, ExecutiveOperationsSnapshot } from "@/lib/operations-platform/types";
import { getMrr } from "@/lib/cloud-platform/subscriptions";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { captureCustomerHealthProfiles } from "@/lib/operations-platform/customer-success";
import { captureRevenueSnapshot } from "@/lib/operations-platform/revenue";
import { capturePlatformSnapshot } from "@/lib/operations-platform/monitoring";
import { captureSecuritySnapshot } from "@/lib/operations-platform/security";
import { captureSupportSnapshot } from "@/lib/operations-platform/support";
import { captureMarketplaceBusiness } from "@/lib/operations-platform/marketplace-business";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getOperationsHubSummary(supabase: AuthClient): Promise<OperationsHubSummary> {
  const [customers, subscriptions, tickets, incidents, mrr, atRisk, platform, executive] = await Promise.all([
    supabase.from("cloud_customers").select("id", { count: "exact", head: true }),
    supabase.from("cloud_subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trial"]),
    supabase.from("cloud_support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("cloud_incidents").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    getMrr(supabase),
    supabase.from("cloud_customers").select("id", { count: "exact", head: true }).in("risk_level", ["high", "critical"]),
    supabase.from("ops_platform_snapshots").select("platform_uptime_pct").order("snapshot_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ops_executive_snapshots").select("customer_health_pct").order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    totalCustomers: customers.count ?? 0,
    activeSubscriptions: subscriptions.count ?? 0,
    mrr,
    arr: mrr * 12,
    openTickets: tickets.count ?? 0,
    openIncidents: incidents.count ?? 0,
    platformHealthPct: Number(platform.data?.platform_uptime_pct ?? 99.9),
    customerHealthPct: Number(executive.data?.customer_health_pct ?? 90),
    atRiskCustomers: atRisk.count ?? 0,
  };
}

export async function captureExecutiveSnapshot(supabase: AuthClient): Promise<ExecutiveOperationsSnapshot> {
  const today = new Date().toISOString().split("T")[0];
  const mrr = await getMrr(supabase);
  const customers = await getCustomers(supabase);
  const students = customers.reduce((s, c) => s + (c.student_count ?? 0), 0);
  const employees = customers.reduce((s, c) => s + (c.employee_count ?? 0), 0);
  const renewalsDue = customers.filter((c) => c.renewal_date && new Date(c.renewal_date) < new Date(Date.now() + 30 * 86400000)).length;
  const atRisk = customers.filter((c) => c.risk_level === "high" || c.risk_level === "critical").length;
  const avgHealth = customers.length
    ? customers.reduce((s, c) => s + Number(c.health_score ?? 0), 0) / customers.length
    : 90;

  const snapshot: ExecutiveOperationsSnapshot = {
    organizationsCount: customers.filter((c) => c.organization_id).length,
    studentsManaged: students,
    employeesManaged: employees,
    mrr,
    arr: mrr * 12,
    churnPct: atRisk ? (atRisk / Math.max(customers.length, 1)) * 100 : 0,
    renewalsDue,
    platformHealthPct: 99.9,
    supportHealthPct: 95,
    customerHealthPct: avgHealth,
    marketplaceRevenue: 0,
    implementationPipeline: customers.filter((c) => c.implementation_status !== "completed").length,
    forecastMrr: mrr * 1.08,
  };

  await supabase.from("ops_executive_snapshots").upsert({
    snapshot_date: today,
    organizations_count: snapshot.organizationsCount,
    students_managed: snapshot.studentsManaged,
    employees_managed: snapshot.employeesManaged,
    mrr: snapshot.mrr,
    arr: snapshot.arr,
    churn_pct: snapshot.churnPct,
    renewals_due: snapshot.renewalsDue,
    platform_health_pct: snapshot.platformHealthPct,
    support_health_pct: snapshot.supportHealthPct,
    customer_health_pct: snapshot.customerHealthPct,
    marketplace_revenue: snapshot.marketplaceRevenue,
    implementation_pipeline: snapshot.implementationPipeline,
    forecast_mrr: snapshot.forecastMrr,
  }, { onConflict: "snapshot_date" });

  return snapshot;
}

async function alertOps(
  supabase: AuthClient,
  title: string,
  body: string,
  href: string,
  entityType: string,
  entityId: string,
  severity: "low" | "normal" | "high" | "critical" = "high"
) {
  const { data: existing } = await supabase
    .from("platform_mission_control_items")
    .select("id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("is_resolved", false)
    .maybeSingle();
  if (existing) return;

  const { data: school } = await supabase.from("schools").select("id").limit(1).maybeSingle();
  await createMissionControlItem(supabase, {
    schoolId: school?.id ?? "",
    module: "mission_control",
    itemType: "executive_alert",
    title,
    body,
    href,
    entityType,
    entityId,
    assignedRole: "CEO",
    severity,
  });
}

export async function syncOperationsPlatform(supabase: AuthClient) {
  await captureExecutiveSnapshot(supabase);
  await captureCustomerHealthProfiles(supabase);
  await captureRevenueSnapshot(supabase);
  await capturePlatformSnapshot(supabase);
  await captureSecuritySnapshot(supabase);
  await captureSupportSnapshot(supabase);
  await captureMarketplaceBusiness(supabase);

  const [executive, platform, security, support] = await Promise.all([
    supabase.from("ops_executive_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ops_platform_snapshots").select("*").order("snapshot_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ops_security_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ops_support_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (platform.data && Number(platform.data.platform_uptime_pct) < 99) {
    await alertOps(supabase, "Operations: platform outage", `Uptime ${platform.data.platform_uptime_pct}%`, "/operations/monitoring", "ops_platform_snapshots", platform.data.id, "critical");
  }
  if (executive.data && Number(executive.data.customer_health_pct) < 70) {
    await alertOps(supabase, "Operations: customer health decline", `Avg health ${executive.data.customer_health_pct}%`, "/operations/customer-health", "ops_executive_snapshots", executive.data.id);
  }
  if (executive.data && executive.data.renewals_due > 0) {
    await alertOps(supabase, "Operations: subscription expiration", `${executive.data.renewals_due} renewal(s) due`, "/operations/subscriptions", "ops_executive_snapshots", `${executive.data.id}-renewals`, "normal");
  }
  if (security.data && security.data.threat_alerts > 0) {
    await alertOps(supabase, "Operations: security incident", `${security.data.threat_alerts} threat alert(s)`, "/operations/security", "ops_security_snapshots", security.data.id, "critical");
  }
  if (support.data && support.data.sla_breaches > 0) {
    await alertOps(supabase, "Operations: SLA breach", `${support.data.sla_breaches} SLA breach(es)`, "/operations/support", "ops_support_snapshots", support.data.id);
  }

  const { data: failedBackups } = await supabase.from("ops_backup_records").select("id").eq("status", "failed").limit(1);
  if (failedBackups?.length) {
    await alertOps(supabase, "Operations: backup failure", "Backup verification failed", "/operations/backups", "ops_backup_records", failedBackups[0].id, "critical");
  }

  const { data: failedDeploy } = await supabase.from("ops_deployment_rollouts").select("id, release_version").eq("status", "failed").limit(1);
  if (failedDeploy?.length) {
    await alertOps(supabase, "Operations: failed deployment", `Release ${failedDeploy[0].release_version}`, "/operations/deployments", "ops_deployment_rollouts", failedDeploy[0].id, "critical");
  }
}

export async function getLatestExecutiveSnapshot(supabase: AuthClient) {
  const { data } = await supabase.from("ops_executive_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
  return data;
}
