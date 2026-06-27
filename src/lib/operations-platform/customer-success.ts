import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function recommendActions(scores: {
  health: number; risk: number; adoption: number; training: number; implementation: number; support: number;
}) {
  const actions: string[] = [];
  if (scores.health < 70) actions.push("Schedule executive check-in");
  if (scores.adoption < 50) actions.push("Offer adoption workshop");
  if (scores.training < 60) actions.push("Enroll in AcademyOS University courses");
  if (scores.implementation < 80) actions.push("Assign implementation specialist");
  if (scores.support < 70) actions.push("Review open support tickets");
  if (scores.risk > 60) actions.push("Escalate to Customer Success manager");
  if (!actions.length) actions.push("Monitor — customer healthy");
  return actions;
}

export async function captureCustomerHealthProfiles(supabase: AuthClient) {
  const { data: customers } = await supabase.from("cloud_customers").select("*").limit(100);
  const today = new Date().toISOString().split("T")[0];

  for (const c of customers ?? []) {
    const { count: openTickets } = await supabase
      .from("cloud_support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", c.id)
      .in("status", ["open", "in_progress"]);

    const health = Math.max(0, Number(c.health_score) - (openTickets ?? 0) * 3);
    const adoption = c.go_live_status === "live" ? 80 : 30;
    const training = c.training_status === "completed" ? 95 : c.training_status === "in_progress" ? 50 : 20;
    const implementation = c.implementation_status === "completed" ? 100 : c.implementation_status === "in_progress" ? 60 : 20;
    const support = Math.max(0, 100 - (openTickets ?? 0) * 10);
    const risk = Math.min(100, 100 - health + (openTickets ?? 0) * 5);
    const renewal = health > 80 ? 90 : health > 50 ? 65 : 35;
    const expansion = adoption > 70 && health > 75 ? 80 : 25;

    const scores = { health, risk, adoption, training, implementation, support };
    await supabase.from("ops_customer_health_profiles").upsert({
      customer_id: c.id,
      profile_date: today,
      health_score: health,
      risk_score: risk,
      adoption_score: adoption,
      training_score: training,
      implementation_progress_pct: implementation,
      support_satisfaction: support,
      renewal_probability_pct: renewal,
      expansion_opportunity_pct: expansion,
      recommended_actions: recommendActions(scores),
    }, { onConflict: "customer_id,profile_date" });
  }
}

export async function getCustomerHealthProfiles(supabase: AuthClient, limit = 50) {
  const { data } = await supabase
    .from("ops_customer_health_profiles")
    .select("*, cloud_customers(customer_name, status)")
    .order("profile_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}
