import { createAuthClient } from "@/lib/supabase/server-auth";
import { aggregateFundingReporting, fetchLeadFundingCodesByLeadIds } from "@/lib/funding/sync";
import { getLeads } from "@/lib/admissions/queries";
import { getExecutiveAdmissionsMetrics } from "@/lib/admissions/executive-metrics";
import { getReconciliationSummary } from "@/lib/admissions/state-funding";

export interface CeoDashboardMetrics {
  pipelineValue: number;
  enrollmentGoal: number;
  enrollmentProgress: number;
  stateFundingTotals: number;
  scholarshipTotals: number;
  forecastedTuition: number;
  conversionFunnel: { label: string; count: number }[];
  marketingRoi: number | null;
  studentsBySchool: Record<string, number>;
  studentsByState: Record<string, number>;
  studentsByFundingSource: Record<string, number>;
}

export async function getCeoDashboardMetrics(): Promise<CeoDashboardMetrics> {
  const supabase = await createAuthClient();

  const [execMetrics, leads, settingsResult, scholarshipResult, reconciliation, studentsResult] =
    await Promise.all([
      getExecutiveAdmissionsMetrics(),
      getLeads(),
      supabase.from("school_admissions_settings").select("enrollment_goal, marketing_spend_annual"),
      supabase
        .from("scholarship_applications")
        .select("approved_amount, scholarship_status")
        .eq("scholarship_status", "approved"),
      getReconciliationSummary(),
      supabase.from("students").select("id, school_id, schools(name)").eq("status", "active"),
    ]);

  const settings = settingsResult.data ?? [];
  const enrollmentGoal = settings.reduce((s, r) => s + (r.enrollment_goal ?? 0), 0) || 100;
  const marketingSpend = settings.reduce((s, r) => s + Number(r.marketing_spend_annual ?? 0), 0);

  const scholarshipTotals = (scholarshipResult.data ?? []).reduce(
    (s, r) => s + Number(r.approved_amount ?? 0),
    0
  );

  const leadIds = leads.map((l) => l.id);
  const fundingByLead = await fetchLeadFundingCodesByLeadIds(supabase, leadIds);
  const fundingReport = aggregateFundingReporting(
    leads.map((l) => ({ funding_sources: fundingByLead.get(l.id) ?? l.funding_sources }))
  );

  const studentsBySchool: Record<string, number> = {};
  const studentsByState: Record<string, number> = {};

  for (const row of studentsResult.data ?? []) {
    const schoolName =
      (row.schools as { name?: string } | null)?.name ?? "Unknown";
    studentsBySchool[schoolName] = (studentsBySchool[schoolName] ?? 0) + 1;
  }

  for (const lead of leads) {
    const codes = fundingByLead.get(lead.id) ?? lead.funding_sources;
    if (codes.some((c) => c.includes("esa") || c.includes("step_up") || c.includes("fes"))) {
      studentsByState["FL"] = (studentsByState["FL"] ?? 0) + 1;
    } else if (codes.some((c) => c.includes("ga") || lead.program?.includes("ga"))) {
      studentsByState["GA"] = (studentsByState["GA"] ?? 0) + 1;
    } else {
      studentsByState["Other"] = (studentsByState["Other"] ?? 0) + 1;
    }
  }

  const enrolledCount = leads.filter((l) => l.lead_stage === "enrolled").length;
  const marketingRoi =
    marketingSpend > 0
      ? Math.round(((enrolledCount * 12000) / marketingSpend) * 100) / 100
      : null;

  return {
    pipelineValue: execMetrics.forecastedTuition,
    enrollmentGoal,
    enrollmentProgress: enrollmentGoal
      ? Math.round((enrolledCount / enrollmentGoal) * 100)
      : 0,
    stateFundingTotals: reconciliation.receivedTotal + execMetrics.forecastedStateFundingRevenue,
    scholarshipTotals,
    forecastedTuition: execMetrics.forecastedTuition,
    conversionFunnel: execMetrics.funnel,
    marketingRoi,
    studentsBySchool,
    studentsByState,
    studentsByFundingSource: fundingReport.byFunding,
  };
}
