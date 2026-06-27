import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getResearchReports(supabase: AuthClient) {
  const { data } = await supabase.from("ain_research_reports").select("*").order("published_at", { ascending: false });
  return data ?? [];
}

export async function getResearchReport(supabase: AuthClient, reportKey: string) {
  const { data } = await supabase.from("ain_research_reports").select("*").eq("report_key", reportKey).maybeSingle();
  return data;
}
