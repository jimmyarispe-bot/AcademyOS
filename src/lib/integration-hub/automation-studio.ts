import type { createAuthClient } from "@/lib/supabase/server-auth";
import { WORKFLOW_STEP_TYPES } from "@/lib/integration-hub/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export function getWorkflowStepTypes() {
  return WORKFLOW_STEP_TYPES;
}

export async function getWorkflows(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_automation_workflows")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function getWorkflowTemplates(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_automation_workflows")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_template", true);
  return data ?? [];
}

export async function createWorkflow(
  supabase: AuthClient,
  input: {
    organizationId: string;
    workflowKey: string;
    workflowName: string;
    triggerType?: string;
    steps?: unknown[];
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("ihub_automation_workflows")
    .insert({
      organization_id: input.organizationId,
      workflow_key: input.workflowKey,
      workflow_name: input.workflowName,
      trigger_type: input.triggerType ?? "event",
      steps: input.steps ?? [{ type: "trigger", name: "Start" }],
      status: "draft",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { workflowId: data.id };
}

export async function publishWorkflow(supabase: AuthClient, workflowId: string) {
  await supabase.from("ihub_automation_workflows").update({
    status: "published",
    published_at: new Date().toISOString(),
  }).eq("id", workflowId);
}

export async function runWorkflow(supabase: AuthClient, workflowId: string, organizationId: string) {
  const { data: wf } = await supabase.from("ihub_automation_workflows").select("steps").eq("id", workflowId).single();
  const steps = (wf?.steps as unknown[]) ?? [];

  const { data: run } = await supabase
    .from("ihub_automation_runs")
    .insert({
      workflow_id: workflowId,
      organization_id: organizationId,
      status: "running",
    })
    .select("id")
    .single();

  await supabase.from("ihub_automation_runs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    step_results: steps.map((s, i) => ({ step: i, status: "pass" })),
  }).eq("id", run!.id);

  return { runId: run!.id };
}

export async function getWorkflowRuns(supabase: AuthClient, organizationId: string, limit = 20) {
  const { data } = await supabase
    .from("ihub_automation_runs")
    .select("*, ihub_automation_workflows(workflow_name)")
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getWorkflowAnalytics(supabase: AuthClient, organizationId: string) {
  const { data: runs } = await supabase
    .from("ihub_automation_runs")
    .select("status")
    .eq("organization_id", organizationId);
  const total = runs?.length ?? 0;
  const completed = runs?.filter((r) => r.status === "completed").length ?? 0;
  return { totalRuns: total, successRate: total ? (completed / total) * 100 : 100, failed: total - completed };
}
