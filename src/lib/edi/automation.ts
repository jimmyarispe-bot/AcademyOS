import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { generateAllRecommendations, getTopRecommendations } from "@/lib/edi/recommendation-engine";
import { computeExecutiveScorecard } from "@/lib/edi/scorecard";
import { generateExecutiveBriefings } from "@/lib/edi/briefings";
import { computeCapacitySnapshot } from "@/lib/edi/capacity-planning";
import { computeEducationalRoi } from "@/lib/edi/educational-roi";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function syncExecutiveDecisionIntelligence(supabase: AuthClient) {
  const { data: schools } = await supabase.from("schools").select("id").limit(50);

  for (const school of schools ?? []) {
    await generateAllRecommendations(supabase, school.id);
    await computeExecutiveScorecard(supabase, school.id);
    await computeCapacitySnapshot(supabase, school.id);
    await computeEducationalRoi(supabase, school.id);
    await generateExecutiveBriefings(supabase, school.id);
  }

  await syncEdiAlertsToMissionControl(supabase);
}

export async function syncEdiAlertsToMissionControl(supabase: AuthClient) {
  const { data: schools } = await supabase.from("schools").select("id").limit(50);

  for (const school of schools ?? []) {
    const recs = await getTopRecommendations(supabase, school.id, 30);

    for (const rec of recs.filter((r) => r.priority === "critical" || r.riskLevel === "critical")) {
      const { data: existing } = await supabase
        .from("platform_mission_control_items")
        .select("id")
        .eq("entity_type", "edi_recommendations")
        .eq("entity_id", rec.id)
        .eq("is_resolved", false)
        .maybeSingle();

      if (existing || !rec.id) continue;

      await createMissionControlItem(supabase, {
        schoolId: school.id,
        module: "executive",
        itemType: "executive_alert",
        title: `EDI: ${rec.issue}`,
        body: rec.recommendedAction,
        href: "/dashboard/executive/decisions",
        entityType: "edi_recommendations",
        entityId: rec.id,
        assignedRole: rec.decisionOwnerRole ?? "SCHOOL_LEADER",
        severity: rec.priority === "critical" ? "critical" : "high",
      });
    }
  }
}
