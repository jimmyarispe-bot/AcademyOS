import { createAuthClient } from "@/lib/supabase/server-auth";
import { getStudentDashboardSummary } from "@/lib/sis/queries";
import { getLatestStudentSuccessScore } from "@/lib/ssis/score";
import { getStudentFundingCenter } from "@/lib/ssis/funding";
import { aggregateStudentTimeline } from "@/lib/ssis/timeline";
import { getParentEngagementSummary } from "@/lib/ssis/engagement";
import type { SuccessScoreResult } from "@/lib/ssis/score";

export interface ExecutiveSummary extends Awaited<ReturnType<typeof getStudentDashboardSummary>> {
  successScore: SuccessScoreResult | null;
  scholarshipCount: number;
  fundingRecordCount: number;
  stateFundingVerified: boolean;
  parentEngagementScore: number;
  parentDisengaged: boolean;
  missionControlAlertCount: number;
  lifecycleStage: string;
  outstandingTasks: number;
}

export async function getStudentExecutiveSummary(
  studentId: string,
  admissionsLeadId?: string | null
): Promise<ExecutiveSummary> {
  const supabase = await createAuthClient();

  const [base, successScore, funding, engagement, timeline, studentRes, missionRes] =
    await Promise.all([
      getStudentDashboardSummary(studentId),
      getLatestStudentSuccessScore(supabase, studentId),
      getStudentFundingCenter(supabase, studentId),
      getParentEngagementSummary(supabase, studentId),
      aggregateStudentTimeline(supabase, studentId, admissionsLeadId),
      supabase.from("students").select("lifecycle_stage").eq("id", studentId).single(),
      supabase
        .from("platform_mission_control_items")
        .select("id")
        .eq("entity_type", "student")
        .eq("entity_id", studentId)
        .eq("is_resolved", false),
    ]);

  const scholarships = funding.filter((f) =>
    ["school_scholarship", "outside_scholarship"].includes(f.funding_category as string)
  );
  const stateFunding = funding.filter((f) => f.funding_category === "state_funding");

  return {
    ...base,
    successScore,
    scholarshipCount: scholarships.length,
    fundingRecordCount: funding.length,
    stateFundingVerified: stateFunding.some((f) => f.verification_status === "verified"),
    parentEngagementScore: engagement.engagementScore,
    parentDisengaged: engagement.disengaged,
    missionControlAlertCount: missionRes.data?.length ?? 0,
    lifecycleStage: studentRes.data?.lifecycle_stage ?? "active",
    outstandingTasks: missionRes.data?.length ?? 0,
  };
}

export { aggregateStudentTimeline, getStudentFundingCenter, getParentEngagementSummary };
export type { SuccessScoreResult };
