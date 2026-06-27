"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePermission } from "@/lib/platform/identity/permissions";
import { buildScenarioProjections } from "@/lib/executive/forecasting";
import { writePlatformAudit } from "@/lib/platform/automation/audit";

async function assertExecutive() {
  const supabase = await createAuthClient();
  const gate = await requirePermission(supabase, "executive.intelligence");
  if (gate.ok) return { supabase };
  const dash = await requirePermission(supabase, "executive.dashboard");
  if (dash.ok) return { supabase };
  return { error: "Forbidden" as const };
}

async function assertStrategic() {
  const supabase = await createAuthClient();
  const gate = await requirePermission(supabase, "executive.strategic");
  if (!gate.ok) return { error: "Forbidden" as const };
  return { supabase };
}

export async function saveDashboardLayoutAction(formData: FormData) {
  const auth = await assertExecutive();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const widgets = JSON.parse(String(formData.get("widgets") ?? "[]"));
  await supabase.from("executive_dashboard_layouts").upsert(
    {
      user_id: user.id,
      layout_name: "default",
      widgets,
      is_default: true,
    },
    { onConflict: "user_id,layout_name" }
  );

  revalidatePath("/dashboard/executive");
  return { success: true };
}

export async function createStrategicGoalAction(formData: FormData) {
  const auth = await assertStrategic();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;

  const { error } = await supabase.from("executive_strategic_goals").insert({
    school_id: (formData.get("school_id") as string) || null,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    goal_type: (formData.get("goal_type") as string) || "organizational",
    target_date: (formData.get("target_date") as string) || null,
    linked_kpi_key: (formData.get("linked_kpi_key") as string) || null,
    budget_amount: Number(formData.get("budget_amount")) || null,
    status: "active",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/executive/strategic");
  return { success: true };
}

export async function createForecastScenarioAction(formData: FormData) {
  const auth = await assertExecutive();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;
  const { data: { user } } = await supabase.auth.getUser();
  const schoolId = formData.get("school_id") as string;

  const projections = await buildScenarioProjections(supabase, schoolId, {
    enrollmentGrowthPct: Number(formData.get("enrollment_growth_pct") || 0),
    scholarshipGrowthPct: Number(formData.get("scholarship_growth_pct") || 0),
    payrollGrowthPct: Number(formData.get("payroll_growth_pct") || 5),
  });

  const { error } = await supabase.from("executive_forecast_scenarios").insert({
    school_id: schoolId,
    scenario_name: formData.get("scenario_name") as string,
    scenario_type: (formData.get("scenario_type") as string) || "custom",
    assumptions: {
      enrollment_growth_pct: Number(formData.get("enrollment_growth_pct") || 0),
      scholarship_growth_pct: Number(formData.get("scholarship_growth_pct") || 0),
      payroll_growth_pct: Number(formData.get("payroll_growth_pct") || 5),
    },
    created_by: user?.id ?? null,
    ...projections,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/executive/forecasting");
  return { success: true };
}

export async function createComplianceRequirementAction(formData: FormData) {
  const auth = await assertStrategic();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;

  const { error } = await supabase.from("executive_compliance_requirements").insert({
    school_id: (formData.get("school_id") as string) || null,
    requirement_type: formData.get("requirement_type") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    due_date: (formData.get("due_date") as string) || null,
    regulatory_body: (formData.get("regulatory_body") as string) || null,
    status: "pending",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/executive/compliance");
  return { success: true };
}

export async function createGrantAction(formData: FormData) {
  const auth = await assertStrategic();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;

  const { error } = await supabase.from("executive_grants").insert({
    school_id: formData.get("school_id") as string,
    grant_name: formData.get("grant_name") as string,
    funder_name: (formData.get("funder_name") as string) || null,
    pipeline_stage: (formData.get("pipeline_stage") as string) || "prospect",
    award_amount: Number(formData.get("award_amount")) || null,
    reporting_deadline: (formData.get("reporting_deadline") as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/executive/grants");
  return { success: true };
}

export async function saveReportTemplateAction(formData: FormData) {
  const auth = await assertExecutive();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("executive_report_templates").insert({
    school_id: (formData.get("school_id") as string) || null,
    created_by: user?.id ?? null,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    report_type: (formData.get("report_type") as string) || "custom",
    config: JSON.parse(String(formData.get("config") ?? "{}")),
    export_formats: ["csv"],
  });

  if (error) return { error: error.message };

  await writePlatformAudit(supabase, {
    module: "executive",
    entityType: "executive_report_templates",
    entityId: "",
    actionType: "report_template_created",
    summary: `Report template: ${formData.get("name")}`,
    actorUserId: user?.id,
    schoolId: (formData.get("school_id") as string) || undefined,
  });

  revalidatePath("/dashboard/executive/reports");
  return { success: true };
}

export async function dismissInsightAction(formData: FormData) {
  const auth = await assertExecutive();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;
  const { data: { user } } = await supabase.auth.getUser();

  await supabase
    .from("executive_insights")
    .update({
      is_dismissed: true,
      dismissed_by: user?.id ?? null,
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", formData.get("insight_id") as string);

  revalidatePath("/dashboard/executive");
  return { success: true };
}

export async function dismissInsightFormAction(formData: FormData) {
  await dismissInsightAction(formData);
}
