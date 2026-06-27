import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DecisionCard } from "@/lib/edi/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export function buildCsvExport(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col];
          const str = val == null ? "" : String(val);
          return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function recommendationsToRows(cards: DecisionCard[]) {
  return cards.map((r) => ({
    domain: r.domain,
    type: r.recommendationType,
    issue: r.issue,
    action: r.recommendedAction,
    financial_impact: r.financialImpact,
    priority: r.priority,
    risk: r.riskLevel,
    confidence: r.confidenceScore,
    score: r.recommendationScore,
  }));
}

export async function buildBoardReportCsv(supabase: AuthClient, schoolId: string) {
  const { data: briefing } = await supabase
    .from("edi_briefings")
    .select("content, summary, title")
    .eq("school_id", schoolId)
    .eq("briefing_type", "board_summary")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: scorecard } = await supabase
    .from("edi_scorecard_snapshots")
    .select("*")
    .eq("school_id", schoolId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rows = [
    { section: "Executive Summary", metric: "summary", value: briefing?.summary ?? "" },
    { section: "Enterprise Health", metric: "overall", value: scorecard?.overall_enterprise_health ?? "" },
    { section: "Financial Health", metric: "score", value: scorecard?.financial_health ?? "" },
    { section: "Enrollment Health", metric: "score", value: scorecard?.enrollment_health ?? "" },
    { section: "Student Success", metric: "score", value: scorecard?.student_success ?? "" },
    { section: "Risk", metric: "score", value: scorecard?.risk ?? "" },
  ];

  return buildCsvExport(rows, ["section", "metric", "value"]);
}

export async function getStoredRecommendationsReport(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("rpt_edi_recommendations").select("*");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}
