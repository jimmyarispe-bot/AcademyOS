import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DecisionCard } from "@/lib/edi/types";
import { scoreRecommendation } from "@/lib/edi/types";
import { generateSchedulingRecommendations } from "@/lib/scheduling/intelligence";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateSchedulingDecisions(
  supabase: AuthClient,
  schoolId: string
): Promise<DecisionCard[]> {
  const schedulingRecs = await generateSchedulingRecommendations(supabase, schoolId);
  const cards: DecisionCard[] = [];

  for (const rec of schedulingRecs) {
    const priority = rec.priority === "high" ? "high" : rec.priority === "medium" ? "normal" : "low";
    const card: DecisionCard = {
      schoolId,
      domain: "scheduling",
      recommendationType: rec.category,
      entityKey: rec.title,
      issue: rec.title,
      evidence: rec.detail,
      whatHappened: rec.detail,
      whyHappened: "Scheduling intelligence detected utilization or conflict pattern",
      likelyNext: "Operational inefficiency or compliance risk if unresolved",
      supportingMetrics: { category: rec.category },
      financialImpact: rec.priority === "high" ? -3000 : -500,
      operationalImpact: 1,
      studentSuccessImpact: rec.category === "workload" ? -5 : 0,
      riskLevel: rec.priority === "high" ? "high" : "medium",
      priority,
      confidenceScore: 85,
      recommendationScore: 0,
      estimatedTimeline: "7–30 days",
      recommendedAction: rec.action ?? "Review scheduling dashboard",
      alternativeOptions: [{ action: "Defer to next term", impact: "Temporary workaround" }],
      decisionOwnerRole: "SCHOOL_LEADER",
      approvalStatus: "pending",
    };
    card.recommendationScore = scoreRecommendation(card);
    cards.push(card);
  }

  const { data: rooms } = await supabase
    .from("schedule_rooms")
    .select("id, room_name, capacity, school_id")
    .eq("school_id", schoolId);

  const { data: sessions } = await supabase
    .from("instructional_sessions")
    .select("schedule_room_id, scheduled_start, scheduled_end, course_sections(courses(school_id))")
    .gte("scheduled_start", new Date(Date.now() - 7 * 86400000).toISOString());

  const roomUsage = new Map<string, number>();
  for (const sess of sessions ?? []) {
    const cs = Array.isArray(sess.course_sections) ? sess.course_sections[0] : sess.course_sections;
    const course = cs && (Array.isArray((cs as { courses?: unknown }).courses) ? (cs as { courses: { school_id?: string }[] }).courses[0] : (cs as { courses?: { school_id?: string } }).courses);
    if (course?.school_id !== schoolId || !sess.schedule_room_id) continue;
    roomUsage.set(sess.schedule_room_id, (roomUsage.get(sess.schedule_room_id) ?? 0) + 1);
  }

  for (const room of rooms ?? []) {
    const usage = roomUsage.get(room.id) ?? 0;
    if (usage === 0) {
      const card: DecisionCard = {
        schoolId,
        domain: "scheduling",
        recommendationType: "unused_classroom",
        entityType: "room",
        entityId: room.id,
        entityKey: room.room_name,
        issue: `Unused classroom: ${room.room_name}`,
        evidence: `No sessions scheduled in the past 7 days`,
        whatHappened: "Room capacity is idle",
        whyHappened: "Schedule gaps or virtual instruction shift",
        likelyNext: "Facility cost without revenue contribution",
        supportingMetrics: { capacity: room.capacity, sessions: usage },
        financialImpact: -(room.capacity ?? 10) * 50,
        operationalImpact: room.capacity ?? 0,
        studentSuccessImpact: 0,
        riskLevel: "low",
        priority: "low",
        confidenceScore: 70,
        recommendationScore: 0,
        estimatedTimeline: "30 days",
        recommendedAction: "Reassign sessions or reduce facility allocation",
        alternativeOptions: [{ action: "Lease/sublease unused space", impact: "Revenue offset" }],
        decisionOwnerRole: "SCHOOL_LEADER",
        approvalStatus: "pending",
      };
      card.recommendationScore = scoreRecommendation(card);
      cards.push(card);
    }
  }

  return cards;
}
