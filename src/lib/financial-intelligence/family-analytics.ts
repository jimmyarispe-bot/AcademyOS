import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { FamilyAnalyticsRow } from "@/lib/financial-intelligence/types";
import { healthFromMargin } from "@/lib/financial-intelligence/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getFamilyAnalytics(
  supabase: AuthClient,
  schoolId: string,
  limit = 50
): Promise<FamilyAnalyticsRow[]> {
  const { data: accounts } = await supabase
    .from("family_billing_accounts")
    .select("id, family_id, balance, school_id")
    .eq("school_id", schoolId)
    .limit(limit);

  const rows: FamilyAnalyticsRow[] = [];

  for (const acct of accounts ?? []) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("total_amount, amount_paid, scholarship_credit, state_funding_credit, due_date, invoice_status")
      .eq("billing_account_id", acct.id);

    const lifetimeRevenue = (invoices ?? []).reduce((s, i) => s + Number(i.amount_paid), 0);
    const aidReceived = (invoices ?? []).reduce(
      (s, i) => s + Number(i.scholarship_credit ?? 0) + Number(i.state_funding_credit ?? 0),
      0
    );
    const outstanding = Number(acct.balance ?? 0);
    const overdue = (invoices ?? []).filter((i) => i.invoice_status === "overdue").length;
    const paidOnTime = (invoices ?? []).filter((i) => i.invoice_status === "paid").length;
    const totalInvoices = invoices?.length ?? 0;
    const paymentReliability = totalInvoices ? Math.round((paidOnTime / totalInvoices) * 100) : 100;
    const monthsActive = Math.max(totalInvoices, 1);
    const avgMonthlyRevenue = lifetimeRevenue / monthsActive;

    let collectionRisk: "green" | "yellow" | "red" = "green";
    if (overdue > 2 || outstanding > 5000) collectionRisk = "red";
    else if (overdue > 0 || paymentReliability < 80) collectionRisk = "yellow";

    rows.push({
      familyId: acct.family_id,
      lifetimeRevenue,
      outstandingBalance: outstanding,
      aidReceived,
      paymentReliability,
      avgMonthlyRevenue,
      collectionRisk,
    });

    await supabase.from("fi_profitability_snapshots").upsert(
      {
        school_id: schoolId,
        entity_type: "family",
        entity_id: acct.family_id,
        entity_key: acct.family_id,
        period_type: "annual",
        period_start: `${new Date().getFullYear()}-01-01`,
        period_end: new Date().toISOString().split("T")[0],
        revenue: lifetimeRevenue,
        total_cost: aidReceived,
        net_margin: lifetimeRevenue - outstanding,
        margin_pct: lifetimeRevenue ? ((lifetimeRevenue - outstanding) / lifetimeRevenue) * 100 : 0,
        health_indicator: collectionRisk,
        metrics: { payment_reliability: paymentReliability, overdue_count: overdue },
      },
      { onConflict: "school_id,entity_type,entity_id,entity_key,period_type,period_start" }
    );
  }

  return rows.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);
}
