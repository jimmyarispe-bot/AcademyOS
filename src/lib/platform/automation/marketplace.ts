import { createAuthClient } from "@/lib/supabase/server-auth";
import type { MarketplaceWorkflowTemplate } from "@/lib/platform/automation/types";

export async function getMarketplaceTemplates(module?: string) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("platform_workflow_marketplace")
    .select("*")
    .eq("is_published", true)
    .order("install_count", { ascending: false });

  if (module) query = query.eq("module", module);

  const { data } = await query;
  return (data ?? []) as MarketplaceWorkflowTemplate[];
}

export async function getMarketplaceTemplate(key: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("platform_workflow_marketplace")
    .select("*")
    .eq("marketplace_key", key)
    .single();

  return data as MarketplaceWorkflowTemplate | null;
}

/** Install marketplace template into admissions workflows (draft) */
export async function installMarketplaceTemplateToAdmissions(
  marketplaceKey: string,
  schoolId: string | null
) {
  const supabase = await createAuthClient();
  const template = await getMarketplaceTemplate(marketplaceKey);
  if (!template || template.module !== "admissions") {
    return { error: "Template not found or not admissions-compatible" };
  }

  const def = template.workflow_definition as Record<string, unknown>;
  const workflowKey = `mp_${marketplaceKey}_${Date.now()}`;

  const { data: workflow, error } = await supabase
    .from("admissions_workflows")
    .insert({
      school_id: schoolId,
      workflow_key: workflowKey,
      name: (def.name as string) ?? template.name,
      description: template.description,
      trigger_event: template.trigger_event,
      category: template.category,
      lifecycle_status: "draft",
      is_active: false,
      module: "admissions",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const steps = template.step_definitions ?? [];
  if (steps.length && workflow) {
    await supabase.from("admissions_workflow_steps").insert(
      steps.map((s, i) => ({
        workflow_id: workflow.id,
        step_order: s.step_order ?? i + 1,
        step_type: s.step_type,
        action_type: s.action_type ?? null,
        config: s.config ?? {},
        is_active: true,
      }))
    );
  }

  await supabase
    .from("platform_workflow_marketplace")
    .update({
      install_count: ((template as { install_count?: number }).install_count ?? 0) + 1,
    })
    .eq("marketplace_key", marketplaceKey);

  return { success: true, workflowId: workflow?.id };
}
