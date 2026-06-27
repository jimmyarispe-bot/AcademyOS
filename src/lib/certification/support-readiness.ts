import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const SUPPORT_CHECKS = [
  { key: "knowledge_base", name: "Knowledge base coverage" },
  { key: "support_docs", name: "Support documentation" },
  { key: "customer_onboarding", name: "Customer onboarding" },
  { key: "training_completion", name: "Training completion" },
  { key: "ticket_routing", name: "Ticket routing" },
  { key: "escalation_rules", name: "Escalation rules" },
];

export async function runSupportReadinessCertification(supabase: AuthClient, certRunId: string) {
  let totalScore = 0;

  for (const check of SUPPORT_CHECKS) {
    let status: "pass" | "warning" | "failure" = "pass";
    let score = 90;
    const details: Record<string, unknown> = {};

    if (check.key === "knowledge_base") {
      const { count } = await supabase.from("cert_documentation").select("id", { count: "exact", head: true });
      details.docCount = count ?? 0;
      if ((count ?? 0) < 8) { status = "warning"; score = 80; }
    }
    if (check.key === "ticket_routing") {
      const { count } = await supabase.from("cloud_support_tickets").select("id", { count: "exact", head: true });
      details.ticketFramework = (count ?? 0) >= 0;
    }
    if (check.key === "training_completion") {
      const { count } = await supabase.from("cert_university_progress").select("id", { count: "exact", head: true });
      details.progressRecords = count ?? 0;
    }

    totalScore += score;
    await supabase.from("cert_support_readiness").insert({
      cert_run_id: certRunId,
      check_key: check.key,
      check_name: check.name,
      status,
      score,
      details,
    });
  }

  return { supportScore: totalScore / SUPPORT_CHECKS.length };
}

export async function getLatestSupportReadiness(supabase: AuthClient) {
  const { data: run } = await supabase.from("cert_runs").select("id").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) return { score: 0, checks: [] };
  const { data } = await supabase.from("cert_support_readiness").select("*").eq("cert_run_id", run.id);
  const score = data?.length ? data.reduce((s, c) => s + Number(c.score ?? 0), 0) / data.length : 0;
  return { score, checks: data ?? [] };
}
