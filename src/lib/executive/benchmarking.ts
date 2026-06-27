import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface BenchmarkRow {
  label: string;
  dimension: string;
  metric: string;
  value: number;
  rank: number;
  networkAvg: number;
  vsNetworkPct: number | null;
}

export async function getSchoolBenchmarks(supabase: AuthClient, metric: "enrollment" | "revenue" | "success_score" | "staffing") {
  const { data: enrollment } = await supabase.from("rpt_enrollment_summary").select("*");
  const { data: financial } = await supabase.from("rpt_financial_kpis").select("*");
  const { data: outcomes } = await supabase.from("rpt_student_outcomes").select("*");
  const { data: workforce } = await supabase.from("rpt_workforce_kpis").select("*");

  const schoolMetrics = new Map<string, { label: string; value: number }>();

  if (metric === "enrollment") {
    for (const row of enrollment ?? []) {
      const key = String(row.school_id);
      const existing = schoolMetrics.get(key) ?? { label: String(row.school_name), value: 0 };
      existing.value += Number(row.active_students ?? 0);
      schoolMetrics.set(key, existing);
    }
  } else if (metric === "revenue") {
    for (const row of financial ?? []) {
      const key = String(row.school_id);
      const existing = schoolMetrics.get(key) ?? { label: String(row.school_name), value: 0 };
      existing.value += Number(row.total_collected ?? 0);
      schoolMetrics.set(key, existing);
    }
  } else if (metric === "success_score") {
    for (const row of outcomes ?? []) {
      const key = String(row.school_id);
      const existing = schoolMetrics.get(key) ?? { label: String(row.school_name), value: 0 };
      const score = Number(row.avg_success_score ?? 0);
      if (score) existing.value = existing.value ? (existing.value + score) / 2 : score;
      schoolMetrics.set(key, existing);
    }
  } else {
    for (const row of workforce ?? []) {
      const key = String(row.school_id);
      const existing = schoolMetrics.get(key) ?? { label: String(row.school_name), value: 0 };
      existing.value += Number(row.active_staff ?? 0);
      schoolMetrics.set(key, existing);
    }
  }

  const rows = [...schoolMetrics.values()].sort((a, b) => b.value - a.value);
  const networkAvg = rows.length ? rows.reduce((s, r) => s + r.value, 0) / rows.length : 0;

  return rows.map((row, idx) => ({
    label: row.label,
    dimension: "school",
    metric,
    value: Math.round(row.value * 100) / 100,
    rank: idx + 1,
    networkAvg: Math.round(networkAvg * 100) / 100,
    vsNetworkPct: networkAvg ? Math.round(((row.value - networkAvg) / networkAvg) * 100) : null,
  })) as BenchmarkRow[];
}

export async function getProgramBenchmarks(supabase: AuthClient, schoolId: string) {
  const { data } = await supabase
    .from("rpt_enrollment_summary")
    .select("*")
    .eq("school_id", schoolId);

  const byProgram = new Map<string, number>();
  for (const row of data ?? []) {
    const prog = String(row.program ?? "General");
    byProgram.set(prog, (byProgram.get(prog) ?? 0) + Number(row.active_students ?? 0));
  }

  const rows = [...byProgram.entries()].sort((a, b) => b[1] - a[1]);
  const avg = rows.length ? rows.reduce((s, [, v]) => s + v, 0) / rows.length : 0;

  return rows.map(([label, value], idx) => ({
    label,
    dimension: "program",
    metric: "enrollment",
    value,
    rank: idx + 1,
    networkAvg: Math.round(avg),
    vsNetworkPct: avg ? Math.round(((value - avg) / avg) * 100) : null,
  })) as BenchmarkRow[];
}
