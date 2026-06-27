import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function computeCustomerSuccessSnapshot(supabase: AuthClient, customerId: string) {
  const { data: customer } = await supabase.from("cloud_customers").select("*").eq("id", customerId).single();
  if (!customer) return null;

  const { count: openTickets } = await supabase
    .from("cloud_support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .in("status", ["open", "in_progress", "waiting"]);

  const healthScore = Math.max(0, Number(customer.health_score) - (openTickets ?? 0) * 5);
  const snapshot = {
    customer_id: customerId,
    snapshot_date: new Date().toISOString().split("T")[0],
    health_score: healthScore,
    platform_adoption_pct: customer.go_live_status === "live" ? 75 : 25,
    active_users: customer.employee_count,
    inactive_users: 0,
    training_completion_pct: customer.training_status === "completed" ? 100 : 30,
    open_tickets: openTickets ?? 0,
    renewal_probability_pct: healthScore > 80 ? 90 : healthScore > 50 ? 60 : 30,
    implementation_progress_pct: customer.implementation_status === "completed" ? 100 : 50,
    risk_indicators: healthScore < 60 ? ["Low health score"] : [],
  };

  await supabase.from("cloud_customer_success_snapshots").upsert(snapshot, {
    onConflict: "customer_id,snapshot_date",
  });

  await supabase.from("cloud_customers").update({ health_score: healthScore }).eq("id", customerId);

  return snapshot;
}

export async function getCustomerSuccessSnapshots(supabase: AuthClient, customerId?: string) {
  let query = supabase.from("cloud_customer_success_snapshots").select("*, cloud_customers(customer_name)").order("snapshot_date", { ascending: false });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data } = await query.limit(30);
  return data ?? [];
}

export async function getOnboardingSessions(supabase: AuthClient) {
  const { data } = await supabase
    .from("cloud_onboarding_sessions")
    .select("*, cloud_customers(customer_name)")
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function startOnboarding(supabase: AuthClient, customerId: string, assignedTo?: string) {
  const { data, error } = await supabase
    .from("cloud_onboarding_sessions")
    .insert({
      customer_id: customerId,
      assigned_to: assignedTo ?? null,
      checklist: [
        { step: "welcome", done: false },
        { step: "provisioning", done: false },
        { step: "training", done: false },
        { step: "go_live", done: false },
      ],
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { sessionId: data.id };
}
