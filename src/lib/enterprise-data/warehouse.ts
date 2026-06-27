import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const WAREHOUSE_DOMAINS = [
  "enrollment", "finance", "attendance", "behavior", "student_growth",
  "hr", "scheduling", "compliance", "executive_kpi", "financial_kpi",
] as const;

export async function captureWarehouseSnapshots(supabase: AuthClient, organizationId: string, schoolId?: string) {
  const snapshotDate = new Date().toISOString().split("T")[0];
  const metrics: Record<string, Record<string, number>> = {};

  const { count: enrollment } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("lifecycle_stage", "enrolled");
  metrics.enrollment = { total_enrolled: enrollment ?? 0 };

  const { count: employees } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true });
  metrics.hr = { total_employees: employees ?? 0 };

  for (const domain of WAREHOUSE_DOMAINS) {
    await supabase.from("edp_warehouse_snapshots").upsert(
      {
        organization_id: organizationId,
        school_id: schoolId ?? null,
        snapshot_date: snapshotDate,
        domain,
        metrics: metrics[domain] ?? {},
        period_type: "monthly",
      },
      { onConflict: "organization_id,school_id,snapshot_date,domain,period_type" }
    );
  }

  return { snapshotDate, domains: WAREHOUSE_DOMAINS.length };
}

export async function getWarehouseSnapshots(
  supabase: AuthClient,
  organizationId: string,
  domain?: string,
  limit = 12
) {
  let query = supabase
    .from("edp_warehouse_snapshots")
    .select("*")
    .eq("organization_id", organizationId)
    .order("snapshot_date", { ascending: false });
  if (domain) query = query.eq("domain", domain);
  const { data } = await query.limit(limit);
  return data ?? [];
}

export async function getTrendAnalysis(supabase: AuthClient, organizationId: string, domain: string) {
  const snapshots = await getWarehouseSnapshots(supabase, organizationId, domain, 24);
  return snapshots.reverse().map((s) => ({
    date: s.snapshot_date,
    metrics: s.metrics as Record<string, number>,
  }));
}
