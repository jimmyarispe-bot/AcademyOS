import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getFinanceExecutiveDashboard(supabase: AuthClient, schoolId?: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().split("T")[0];

  let invoicesQuery = supabase.from("invoices").select(`
    total_amount, amount_paid, invoice_status, sibling_discount_amount,
    scholarship_credit, state_funding_credit, family_responsibility, due_date, program,
    family_billing_accounts(school_id, families(id))
  `);

  const { data: invoices } = await invoicesQuery;
  const filteredInvoices = (invoices ?? []).filter((inv) => {
    if (!schoolId) return true;
    const acct = Array.isArray(inv.family_billing_accounts) ? inv.family_billing_accounts[0] : inv.family_billing_accounts;
    return (acct as { school_id?: string })?.school_id === schoolId;
  });

  const totalBilled = filteredInvoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalCollected = filteredInvoices.reduce((s, i) => s + Number(i.amount_paid), 0);
  const outstanding = filteredInvoices
    .filter((i) => !["paid", "void"].includes(i.invoice_status))
    .reduce((s, i) => s + Number(i.total_amount) - Number(i.amount_paid), 0);

  const scholarshipsAwarded = filteredInvoices.reduce((s, i) => s + Number(i.scholarship_credit ?? 0), 0);
  const stateFundingApplied = filteredInvoices.reduce((s, i) => s + Number(i.state_funding_credit ?? 0), 0);

  const revenueByProgram: Record<string, number> = {};
  for (const inv of filteredInvoices) {
    const prog = inv.program ?? "General";
    revenueByProgram[prog] = (revenueByProgram[prog] ?? 0) + Number(inv.total_amount);
  }

  const aging = { current: 0, days30: 0, days60: 0, days90plus: 0 };
  const today = new Date();
  for (const inv of filteredInvoices.filter((i) => !["paid", "void"].includes(i.invoice_status))) {
    const due = new Date(inv.due_date);
    const daysPast = Math.floor((today.getTime() - due.getTime()) / 86400000);
    const balance = Number(inv.total_amount) - Number(inv.amount_paid);
    if (daysPast <= 0) aging.current += balance;
    else if (daysPast <= 30) aging.days30 += balance;
    else if (daysPast <= 60) aging.days60 += balance;
    else aging.days90plus += balance;
  }

  const collectionRate = totalBilled ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const tuitionYield = totalBilled
    ? Math.round(((totalBilled - scholarshipsAwarded - stateFundingApplied) / totalBilled) * 100)
    : 0;

  let forecastQuery = supabase.from("budget_forecast_snapshots").select("*").order("period_start", { ascending: false }).limit(1);
  if (schoolId) forecastQuery = forecastQuery.eq("school_id", schoolId);
  const { data: latestForecast } = await forecastQuery;

  const forecast = latestForecast?.[0];
  const forecastAccuracy =
    forecast && Number(forecast.forecast_tuition) > 0
      ? Math.round((Number(forecast.actual_tuition) / Number(forecast.forecast_tuition)) * 100)
      : null;

  return {
    totalBilled,
    totalCollected,
    outstanding,
    scholarshipsAwarded,
    stateFundingApplied,
    revenueByProgram,
    aging,
    collectionRate,
    tuitionYield,
    forecastAccuracy,
    forecast: forecast ?? null,
    invoiceCount: filteredInvoices.length,
    overdueCount: filteredInvoices.filter((i) => i.invoice_status === "overdue").length,
  };
}

export async function getAgingReport(supabase: AuthClient, schoolId?: string) {
  const dashboard = await getFinanceExecutiveDashboard(supabase, schoolId);
  return dashboard.aging;
}
