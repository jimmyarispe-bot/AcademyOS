import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const FORECAST_TYPES = [
  "enrollment", "revenue", "staffing", "cash_flow", "capacity", "compliance_risk", "intervention_demand",
] as const;

export async function generateForecasts(supabase: AuthClient, organizationId: string) {
  const today = new Date().toISOString().split("T")[0];
  const { count: students } = await supabase.from("students").select("id", { count: "exact", head: true });

  for (const forecastType of FORECAST_TYPES) {
    const base = students ?? 100;
    await supabase.from("ain_forecasts").upsert({
      organization_id: organizationId,
      forecast_date: today,
      forecast_type: forecastType,
      horizon_months: 12,
      projections: {
        month_3: base * 1.02,
        month_6: base * 1.04,
        month_12: base * 1.08,
        trend: "stable",
      },
      confidence_pct: 78,
    }, { onConflict: "organization_id,forecast_date,forecast_type" });
  }
}

export async function getForecasts(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ain_forecasts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("forecast_date", { ascending: false });
  return data ?? [];
}
