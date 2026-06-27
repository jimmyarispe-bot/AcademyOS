import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function buildBudgetForecastSnapshot(supabase: AuthClient, schoolId: string) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const yearEnd = new Date(new Date().getFullYear(), 11, 31).toISOString().split("T")[0];

  const [{ count: enrollmentCount }, { data: plans }, { data: scholarships }, { data: statePayments }, { data: payroll }] =
    await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active"),
      supabase.from("tuition_plans").select("annual_amount").eq("school_id", schoolId).eq("status", "active"),
      supabase.from("scholarship_applications").select("approved_amount, scholarship_status"),
      supabase.from("state_funding_received_payments").select("amount"),
      supabase.from("payroll_records").select("gross_pay").gte("pay_period_start", yearStart),
    ]);

  const forecastTuition = (plans ?? []).reduce((s, p) => s + Number(p.annual_amount), 0) * ((enrollmentCount ?? 0) / Math.max((plans ?? []).length, 1));
  const forecastScholarships = (scholarships ?? [])
    .filter((s) => s.scholarship_status === "approved")
    .reduce((sum, s) => sum + Number(s.approved_amount ?? 0), 0);
  const forecastStateFunding = (statePayments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0) * 1.1;
  const forecastPayroll = (payroll ?? []).reduce((s, p) => s + Number(p.gross_pay ?? 0), 0) * 1.05;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total_amount, scholarship_credit, state_funding_credit, family_billing_accounts!inner(school_id)")
    .eq("family_billing_accounts.school_id", schoolId)
    .gte("issued_at", yearStart);

  const actualTuition = (invoices ?? []).reduce((s, i) => s + Number(i.total_amount), 0);
  const actualScholarships = (invoices ?? []).reduce((s, i) => s + Number(i.scholarship_credit ?? 0), 0);
  const actualStateFunding = (invoices ?? []).reduce((s, i) => s + Number(i.state_funding_credit ?? 0), 0);

  const { data: snapshot } = await supabase
    .from("budget_forecast_snapshots")
    .insert({
      school_id: schoolId,
      snapshot_name: `FY ${new Date().getFullYear()} Forecast`,
      period_start: yearStart,
      period_end: yearEnd,
      forecast_tuition: forecastTuition,
      forecast_scholarships: forecastScholarships,
      forecast_state_funding: forecastStateFunding,
      forecast_payroll: forecastPayroll,
      actual_tuition: actualTuition,
      actual_scholarships: actualScholarships,
      actual_state_funding: actualStateFunding,
      actual_payroll: (payroll ?? []).reduce((s, p) => s + Number(p.gross_pay ?? 0), 0),
      enrollment_count: enrollmentCount ?? 0,
    })
    .select("*")
    .single();

  return snapshot;
}

export async function getLatestForecast(supabase: AuthClient, schoolId?: string) {
  let q = supabase.from("budget_forecast_snapshots").select("*").order("created_at", { ascending: false }).limit(1);
  if (schoolId) q = q.eq("school_id", schoolId);
  const { data } = await q;
  return data?.[0] ?? null;
}
