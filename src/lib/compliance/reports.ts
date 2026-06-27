import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getComplianceDashboardStats, getObligations, getDomainScores } from "@/lib/compliance/queries";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function buildComplianceSummaryReport(supabase: AuthClient, schoolId?: string) {
  const [stats, obligations, scores] = await Promise.all([
    getComplianceDashboardStats(supabase, schoolId),
    getObligations(supabase, { schoolId, limit: 500 }),
    getDomainScores(supabase, schoolId),
  ]);

  const summary = [
    ["metric", "value"],
    ["upcoming_30_days", stats.upcoming],
    ["overdue", stats.overdue],
    ["completed", stats.completed],
    ["compliance_pct", stats.compliancePct],
    ["critical_count", stats.criticalCount],
  ];

  const obligationRows = [
    ["title", "due_date", "status", "risk_level", "priority", "category", "school"],
    ...obligations.map((o) => [
      o.title,
      o.due_date,
      o.status,
      o.risk_level,
      o.priority,
      o.compliance_categories?.name ?? "",
      o.schools?.name ?? "",
    ]),
  ];

  const scoreRows = [
    ["domain", "score_pct", "status", "total", "completed", "overdue"],
    ...scores.map((s) => [s.domain, s.score_pct, s.status_indicator, s.total_obligations, s.completed_obligations, s.overdue_obligations]),
  ];

  return [
    "# Compliance Summary Report",
    `# Generated: ${new Date().toISOString()}`,
    "",
    "# Summary",
    summary.map((r) => r.map(csvEscape).join(",")).join("\n"),
    "",
    "# Domain Scores",
    scoreRows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    "",
    "# Obligations",
    obligationRows.map((r) => r.map(csvEscape).join(",")).join("\n"),
  ].join("\n");
}

export async function buildOverdueReport(supabase: AuthClient, schoolId?: string) {
  const obligations = await getObligations(supabase, { schoolId, overdue: true });
  const rows = [
    ["title", "due_date", "status", "risk_level", "owner", "school"],
    ...obligations.map((o) => [o.title, o.due_date, o.status, o.risk_level, o.owner_user_id ?? "", o.schools?.name ?? ""]),
  ];
  return ["# Overdue Compliance Report", rows.map((r) => r.map(csvEscape).join(",")).join("\n")].join("\n");
}
