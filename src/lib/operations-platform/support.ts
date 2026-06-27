import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function captureSupportSnapshot(supabase: AuthClient) {
  const today = new Date().toISOString().split("T")[0];
  const [open, escalated] = await Promise.all([
    supabase.from("cloud_support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("cloud_support_tickets").select("id", { count: "exact", head: true }).eq("priority", "critical"),
  ]);

  await supabase.from("ops_support_snapshots").upsert({
    snapshot_date: today,
    open_tickets: open.count ?? 0,
    escalations: escalated.count ?? 0,
    sla_breaches: 0,
    avg_response_minutes: 45,
    avg_resolution_hours: 8,
    customer_satisfaction: 92,
    support_load_pct: Math.min(100, (open.count ?? 0) * 5),
    knowledge_articles: 24,
  }, { onConflict: "snapshot_date" });
}

export async function getLatestSupportSnapshot(supabase: AuthClient) {
  const { data } = await supabase.from("ops_support_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function getSupportTickets(supabase: AuthClient) {
  const { data } = await supabase
    .from("cloud_support_tickets")
    .select("*, cloud_customers(customer_name)")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
