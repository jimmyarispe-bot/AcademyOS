import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { NetworkDimensionRow } from "@/lib/executive/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getNetworkDashboardBySchool(supabase: AuthClient): Promise<NetworkDimensionRow[]> {
  const { data: enrollment } = await supabase.from("rpt_enrollment_summary").select("*");
  const { data: financial } = await supabase.from("rpt_financial_kpis").select("*");
  const { data: outcomes } = await supabase.from("rpt_student_outcomes").select("*");
  const { data: workforce } = await supabase.from("rpt_workforce_kpis").select("*");
  const { data: pipeline } = await supabase.from("rpt_admissions_pipeline").select("*");

  const bySchool = new Map<string, NetworkDimensionRow>();

  for (const row of enrollment ?? []) {
    const key = String(row.school_id);
    const existing = bySchool.get(key) ?? {
      dimension: "school",
      dimensionValue: String(row.school_name),
      enrollment: 0,
      revenue: 0,
      outstandingAr: 0,
      avgSuccessScore: null,
      activeStaff: 0,
      pipelineLeads: 0,
      drillHref: `/dashboard/students?school=${key}`,
    };
    existing.enrollment += Number(row.active_students ?? 0);
    bySchool.set(key, existing);
  }

  for (const row of financial ?? []) {
    const key = String(row.school_id);
    const existing = bySchool.get(key);
    if (!existing) continue;
    existing.revenue += Number(row.total_collected ?? 0);
    existing.outstandingAr += Number(row.outstanding_ar ?? 0);
  }

  for (const row of outcomes ?? []) {
    const key = String(row.school_id);
    const existing = bySchool.get(key);
    if (!existing) continue;
    const score = Number(row.avg_success_score);
    if (!Number.isNaN(score)) {
      existing.avgSuccessScore = existing.avgSuccessScore
        ? Math.round((existing.avgSuccessScore + score) / 2)
        : Math.round(score);
    }
  }

  for (const row of workforce ?? []) {
    const key = String(row.school_id);
    const existing = bySchool.get(key);
    if (!existing) continue;
    existing.activeStaff += Number(row.active_staff ?? 0);
  }

  for (const row of pipeline ?? []) {
    const key = String(row.school_id);
    const existing = bySchool.get(key);
    if (!existing) continue;
    existing.pipelineLeads += Number(row.lead_count ?? 0);
  }

  return [...bySchool.values()].sort((a, b) => b.enrollment - a.enrollment);
}

export async function getNetworkDashboardByCampus(
  supabase: AuthClient,
  schoolId: string
): Promise<NetworkDimensionRow[]> {
  const { data: enrollment } = await supabase
    .from("rpt_enrollment_summary")
    .select("*")
    .eq("school_id", schoolId);

  const byCampus = new Map<string, NetworkDimensionRow>();
  for (const row of enrollment ?? []) {
    const campusKey = String(row.campus_id ?? "network");
    const existing = byCampus.get(campusKey) ?? {
      dimension: "campus",
      dimensionValue: String(row.campus_name ?? "Network / Unassigned"),
      enrollment: 0,
      revenue: 0,
      outstandingAr: 0,
      avgSuccessScore: null,
      activeStaff: 0,
      pipelineLeads: 0,
      drillHref: row.campus_id ? `/dashboard/students?campus=${row.campus_id}` : null,
    };
    existing.enrollment += Number(row.active_students ?? 0);
    byCampus.set(campusKey, existing);
  }
  return [...byCampus.values()];
}

export async function getNetworkDashboardByProgram(
  supabase: AuthClient,
  schoolId?: string
): Promise<NetworkDimensionRow[]> {
  let query = supabase.from("rpt_enrollment_summary").select("*");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data: enrollment } = await query;

  const byProgram = new Map<string, NetworkDimensionRow>();
  for (const row of enrollment ?? []) {
    const prog = String(row.program ?? "General");
    const existing = byProgram.get(prog) ?? {
      dimension: "program",
      dimensionValue: prog,
      enrollment: 0,
      revenue: 0,
      outstandingAr: 0,
      avgSuccessScore: null,
      activeStaff: 0,
      pipelineLeads: 0,
      drillHref: `/dashboard/students?program=${encodeURIComponent(prog)}`,
    };
    existing.enrollment += Number(row.active_students ?? 0);
    byProgram.set(prog, existing);
  }
  return [...byProgram.values()].sort((a, b) => b.enrollment - a.enrollment);
}
