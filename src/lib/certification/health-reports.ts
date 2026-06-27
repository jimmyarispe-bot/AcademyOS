import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ReadinessScores } from "@/lib/certification/types";
import { getPrimaryOrganizationId } from "@/lib/certification/context";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateHealthReports(
  supabase: AuthClient,
  scores: ReadinessScores,
  organizationId?: string | null
) {
  const orgId = organizationId ?? (await getPrimaryOrganizationId(supabase));
  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = new Date().getDay();
  const dayOfMonth = new Date().getDate();

  await supabase.from("cert_health_reports").upsert({
    organization_id: orgId,
    report_type: "daily",
    report_date: today,
    health_score: scores.overall,
    summary: { type: "daily", scores },
  }, { onConflict: "organization_id,report_type,report_date" });

  if (dayOfWeek === 1) {
    await supabase.from("cert_health_reports").upsert({
      organization_id: orgId,
      report_type: "weekly",
      report_date: today,
      health_score: scores.overall,
      summary: { type: "weekly", scores, domains: "all" },
    }, { onConflict: "organization_id,report_type,report_date" });
  }

  if (dayOfMonth === 1) {
    await supabase.from("cert_health_reports").upsert({
      organization_id: orgId,
      report_type: "monthly",
      report_date: today,
      health_score: scores.overall,
      summary: { type: "monthly_operational", scores },
    }, { onConflict: "organization_id,report_type,report_date" });
  }
}

export async function getLatestHealthReports(supabase: AuthClient) {
  const { data } = await supabase
    .from("cert_health_reports")
    .select("*")
    .order("report_date", { ascending: false })
    .limit(6);
  return data ?? [];
}
