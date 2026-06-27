import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const RULES = [
  { key: "increase_reading_intervention", category: "academic", title: "Increase Reading Intervention", description: "Reading growth below network median — expand structured literacy intervention.", basis: "reading_growth < p50" },
  { key: "raise_tuition_3pct", category: "financial", title: "Raise Tuition by 3%", description: "Operating margin below peer median while demand is strong.", basis: "operating_margin < p50 && enrollment_growth > p75" },
  { key: "reduce_class_size", category: "academic", title: "Reduce Class Size", description: "Student ratio above peer 75th percentile.", basis: "student_ratio > p75" },
  { key: "hire_sl_teacher", category: "staffing", title: "Hire Another SL Teacher", description: "Structured literacy caseload exceeds network benchmark.", basis: "teacher_caseload > p75" },
  { key: "expand_virtual", category: "enrollment", title: "Expand Virtual Programs", description: "Virtual segment peers show higher enrollment growth.", basis: "enrollment_growth < p50" },
  { key: "increase_scholarship", category: "financial", title: "Increase Scholarship Budget", description: "Yield below peer median — consider scholarship investment.", basis: "yield < p50" },
];

export async function generateRecommendations(supabase: AuthClient, organizationId: string) {
  for (const rule of RULES) {
    await supabase.from("ain_recommendations").upsert({
      organization_id: organizationId,
      recommendation_key: rule.key,
      category: rule.category,
      title: rule.title,
      description: rule.description,
      rule_basis: rule.basis,
      priority: rule.key.includes("reading") || rule.key.includes("sl_teacher") ? "high" : "normal",
      status: "active",
    }, { onConflict: "organization_id,recommendation_key" });
  }
}

export async function getRecommendations(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ain_recommendations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("priority", { ascending: true });
  return data ?? [];
}

export async function dismissRecommendation(supabase: AuthClient, recommendationId: string) {
  await supabase.from("ain_recommendations").update({ status: "dismissed" }).eq("id", recommendationId);
}
