import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { EdiBriefing, DecisionCard } from "@/lib/edi/types";
import { getRecommendations, mapRowToDecisionCard } from "@/lib/edi/decision-engine";
import { computeProgramProfitability } from "@/lib/financial-intelligence/profitability";
import { getRiskRegister } from "@/lib/executive/risk-intelligence";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateExecutiveBriefings(supabase: AuthClient, schoolId: string) {
  const [recRows, programs, risks] = await Promise.all([
    getRecommendations(supabase, schoolId, { limit: 200 }),
    computeProgramProfitability(supabase, schoolId),
    getRiskRegister(supabase, schoolId),
  ]);

  const recs = recRows.map(mapRowToDecisionCard);
  const briefings: EdiBriefing[] = [];

  briefings.push(await saveBriefing(supabase, schoolId, {
    briefingType: "risks",
    title: "Top 25 Risks",
    summary: `${recs.filter((r) => r.riskLevel === "critical" || r.riskLevel === "high").length} high-priority decision risks`,
    content: {
      items: recs.filter((r) => r.riskLevel === "critical" || r.riskLevel === "high").slice(0, 25),
      register_risks: risks.slice(0, 10),
    },
  }));

  briefings.push(await saveBriefing(supabase, schoolId, {
    briefingType: "opportunities",
    title: "Top 25 Opportunities",
    summary: "Highest-scoring recommendations by ROI",
    content: {
      items: [...recs].sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, 25),
    },
  }));

  const sortedPrograms = [...programs].sort((a, b) => b.netMargin - a.netMargin);
  briefings.push(await saveBriefing(supabase, schoolId, {
    briefingType: "roi_programs",
    title: "Program ROI Briefing",
    summary: "Highest and lowest ROI programs",
    content: {
      highest_roi: sortedPrograms.slice(0, 5),
      lowest_roi: [...sortedPrograms].reverse().slice(0, 5),
    },
  }));

  briefings.push(await saveBriefing(supabase, schoolId, {
    briefingType: "staffing",
    title: "Staffing Briefing",
    summary: "Teacher workload and staffing recommendations",
    content: {
      items: recs.filter((r) => r.domain === "teacher" || r.domain === "scheduling").slice(0, 15),
    },
  }));

  briefings.push(await saveBriefing(supabase, schoolId, {
    briefingType: "board_summary",
    title: "Board Executive Summary",
    summary: "Strategic opportunities, risks, and recommendations",
    content: buildBoardSummary(recs, programs, risks),
  }));

  return briefings;
}

function buildBoardSummary(
  recs: DecisionCard[],
  programs: Awaited<ReturnType<typeof computeProgramProfitability>>,
  risks: Awaited<ReturnType<typeof getRiskRegister>>
) {
  return {
    executive_summary: `${recs.length} active recommendations across ${new Set(recs.map((r) => r.domain)).size} domains`,
    strategic_opportunities: recs.filter((r) => r.financialImpact > 0).slice(0, 10),
    strategic_risks: recs.filter((r) => r.riskLevel === "critical").slice(0, 10),
    financial_performance: recs.filter((r) => r.domain === "financial").slice(0, 5),
    enrollment: recs.filter((r) => r.domain === "enrollment").slice(0, 5),
    student_success: recs.filter((r) => r.domain === "student_success").slice(0, 5),
    staffing: recs.filter((r) => r.domain === "teacher").slice(0, 5),
    compliance: risks.filter((r) => r.risk_category === "compliance").slice(0, 5),
    capital_planning: recs.filter((r) => r.domain === "capacity" || r.domain === "scheduling").slice(0, 5),
    future_recommendations: recs.slice(0, 15).map((r) => r.recommendedAction),
  };
}

async function saveBriefing(supabase: AuthClient, schoolId: string, briefing: EdiBriefing) {
  await supabase.from("edi_briefings").insert({
    school_id: schoolId,
    briefing_type: briefing.briefingType,
    title: briefing.title,
    summary: briefing.summary ?? null,
    content: briefing.content,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  return briefing;
}

export async function getLatestBriefings(supabase: AuthClient, schoolId: string, limit = 10) {
  const { data } = await supabase
    .from("edi_briefings")
    .select("*")
    .eq("school_id", schoolId)
    .order("generated_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
