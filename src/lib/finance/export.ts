import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";
import { exportLedgerForGl } from "@/lib/finance/ledger";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function buildFinanceBoardExport(
  supabase: AuthClient,
  schoolId: string,
  dateFrom: string,
  dateTo: string
) {
  const [metrics, ledger] = await Promise.all([
    getFinanceExecutiveDashboard(supabase, schoolId),
    exportLedgerForGl(supabase, schoolId, dateFrom, dateTo),
  ]);

  const summaryRows = [
    ["metric", "value"],
    ["tuition_billed", metrics.totalBilled],
    ["tuition_collected", metrics.totalCollected],
    ["outstanding_ar", metrics.outstanding],
    ["scholarships_applied", metrics.scholarshipsAwarded],
    ["state_funding_applied", metrics.stateFundingApplied],
    ["collection_rate_percent", metrics.collectionRate],
    ["tuition_yield_percent", metrics.tuitionYield],
    ["forecast_accuracy_percent", metrics.forecastAccuracy ?? ""],
    ["ar_aging_current", metrics.aging.current],
    ["ar_aging_30_days", metrics.aging.days30],
    ["ar_aging_60_days", metrics.aging.days60],
    ["ar_aging_90_plus", metrics.aging.days90plus],
  ];

  const programRows = [
    ["program", "revenue"],
    ...Object.entries(metrics.revenueByProgram).map(([prog, amt]) => [prog, amt]),
  ];

  const ledgerHeader = [
    "date",
    "source_module",
    "type",
    "category",
    "amount",
    "student_id",
    "family_id",
    "program",
    "funding_source",
    "description",
    "approval_status",
  ];

  const sections = [
    "# Executive Summary",
    summaryRows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    "",
    "# Revenue by Program",
    programRows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    "",
    "# General Ledger Transactions",
    [ledgerHeader.join(","), ...ledger.map((row) => ledgerHeader.map((h) => csvEscape((row as Record<string, unknown>)[h])).join(","))].join("\n"),
  ];

  return sections.join("\n");
}
