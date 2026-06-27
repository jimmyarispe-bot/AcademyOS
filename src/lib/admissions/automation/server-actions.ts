"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { processWorkflowQueue } from "@/lib/admissions/automation/queue";
import { processCommunicationQueue } from "@/lib/admissions/communications/engine";
import { dispatchAdmissionsAutomation } from "@/lib/admissions/automation/dispatch";
import type { WorkflowTriggerEvent } from "@/lib/admissions/automation/types";

export async function runAutomationProcessor() {
  const supabase = await createAuthClient();
  const { processAllPlatformQueues } = await import("@/lib/platform/automation/process-queues");
  await processAllPlatformQueues(supabase);
  return { success: true };
}

export async function saveWorkflow(formData: FormData) {
  const supabase = await createAuthClient();
  const id = formData.get("id") as string | null;

  const payload = {
    school_id: (formData.get("school_id") as string) || null,
    workflow_key: formData.get("workflow_key") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    trigger_event: formData.get("trigger_event") as string,
    category: (formData.get("category") as string) || "general",
    is_active: false,
    lifecycle_status: "draft",
    module: "admissions",
    sort_order: Number(formData.get("sort_order")) || 0,
  };

  const { data, error } = id
    ? await supabase.from("admissions_workflows").update(payload).eq("id", id).select("id").single()
    : await supabase.from("admissions_workflows").insert(payload).select("id").single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/workflows");
  return { success: true, id: data.id };
}

export async function duplicateWorkflow(workflowId: string) {
  const supabase = await createAuthClient();
  const { data: original } = await supabase
    .from("admissions_workflows")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (!original) return { error: "Workflow not found" };

  const { data: copy, error } = await supabase
    .from("admissions_workflows")
    .insert({
      school_id: original.school_id,
      workflow_key: `${original.workflow_key}_copy_${Date.now()}`,
      name: `${original.name} (Copy)`,
      description: original.description,
      trigger_event: original.trigger_event,
      category: original.category,
      is_active: false,
      lifecycle_status: "draft",
      module: original.module ?? "admissions",
      sort_order: original.sort_order + 1,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { data: steps } = await supabase
    .from("admissions_workflow_steps")
    .select("*")
    .eq("workflow_id", workflowId);

  if (steps?.length && copy) {
    await supabase.from("admissions_workflow_steps").insert(
      steps.map((s) => ({
        workflow_id: copy.id,
        step_order: s.step_order,
        step_type: s.step_type,
        action_type: s.action_type,
        config: s.config,
        is_active: s.is_active,
      }))
    );
  }

  revalidatePath("/dashboard/admissions/workflows");
  return { success: true, id: copy?.id };
}

export async function saveWorkflowStep(formData: FormData) {
  const supabase = await createAuthClient();
  const id = formData.get("id") as string | null;
  const configRaw = formData.get("config") as string;

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(configRaw || "{}");
  } catch {
    return { error: "Invalid step config JSON" };
  }

  const payload = {
    workflow_id: formData.get("workflow_id") as string,
    step_order: Number(formData.get("step_order")) || 0,
    step_type: formData.get("step_type") as string,
    action_type: (formData.get("action_type") as string) || null,
    config,
    is_active: formData.get("is_active") !== "false",
  };

  const { error } = id
    ? await supabase.from("admissions_workflow_steps").update(payload).eq("id", id)
    : await supabase.from("admissions_workflow_steps").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/workflows");
  return { success: true };
}

export async function deleteWorkflowStep(stepId: string) {
  const supabase = await createAuthClient();
  const { error } = await supabase
    .from("admissions_workflow_steps")
    .delete()
    .eq("id", stepId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/workflows");
  return { success: true };
}

export async function toggleWorkflow(workflowId: string, isActive: boolean) {
  const supabase = await createAuthClient();
  const { error } = await supabase
    .from("admissions_workflows")
    .update({ is_active: isActive })
    .eq("id", workflowId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/workflows");
  revalidatePath("/dashboard/admissions/automation");
  return { success: true };
}

export async function reorderWorkflows(orderedIds: string[]) {
  const supabase = await createAuthClient();
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from("admissions_workflows")
      .update({ sort_order: (i + 1) * 10 })
      .eq("id", orderedIds[i]);
  }
  revalidatePath("/dashboard/admissions/workflows");
  return { success: true };
}

export async function saveTemplateWithVersion(formData: FormData) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = formData.get("id") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;
  const changeNotes = (formData.get("change_notes") as string) || null;

  const { data: current } = await supabase
    .from("admissions_communication_templates")
    .select("version_number")
    .eq("id", id)
    .single();

  const nextVersion = (current?.version_number ?? 0) + 1;

  await supabase.from("admissions_template_versions").insert({
    template_id: id,
    version_number: nextVersion,
    subject,
    body,
    changed_by: user?.id ?? null,
    change_notes: changeNotes,
  });

  const { error } = await supabase
    .from("admissions_communication_templates")
    .update({
      name: formData.get("name") as string,
      subject,
      body,
      category: formData.get("category") as string,
      delay_hours: Number(formData.get("delay_hours")) || 0,
      is_active: formData.get("is_active") !== "false",
      version_number: nextVersion,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/communications");
  return { success: true };
}

export async function fireAutomationTrigger(input: {
  leadId: string;
  applicationId?: string | null;
  trigger: WorkflowTriggerEvent;
}) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await dispatchAdmissionsAutomation(supabase, {
    trigger: input.trigger,
    leadId: input.leadId,
    applicationId: input.applicationId,
    sentBy: user?.id ?? null,
    skipLegacyFallback: false,
  });

  revalidatePath(`/dashboard/admissions/leads/${input.leadId}`);
  return { success: true };
}

export async function publishWorkflow(workflowId: string) {
  const supabase = await createAuthClient();
  const { data: workflow } = await supabase
    .from("admissions_workflows")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (!workflow) return { error: "Workflow not found" };
  if (workflow.lifecycle_status === "active") return { success: true };

  if (workflow.parent_workflow_id) {
    await supabase
      .from("admissions_workflows")
      .update({ lifecycle_status: "archived", archived_at: new Date().toISOString(), is_active: false })
      .eq("id", workflow.parent_workflow_id);
  }

  const { error } = await supabase
    .from("admissions_workflows")
    .update({
      lifecycle_status: "active",
      is_active: true,
      published_at: new Date().toISOString(),
    })
    .eq("id", workflowId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/workflows");
  return { success: true };
}

export async function archiveWorkflow(workflowId: string) {
  const supabase = await createAuthClient();
  const { error } = await supabase
    .from("admissions_workflows")
    .update({
      lifecycle_status: "archived",
      is_active: false,
      archived_at: new Date().toISOString(),
    })
    .eq("id", workflowId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/workflows");
  return { success: true };
}

export async function createWorkflowDraftFromActive(workflowId: string) {
  const supabase = await createAuthClient();
  const { data: original } = await supabase
    .from("admissions_workflows")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (!original) return { error: "Workflow not found" };

  const { data: draft, error } = await supabase
    .from("admissions_workflows")
    .insert({
      school_id: original.school_id,
      workflow_key: `${original.workflow_key}_draft_${Date.now()}`,
      name: `${original.name} (Draft)`,
      description: original.description,
      trigger_event: original.trigger_event,
      category: original.category,
      lifecycle_status: "draft",
      is_active: false,
      parent_workflow_id: workflowId,
      module: original.module ?? "admissions",
      sort_order: original.sort_order,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { data: steps } = await supabase
    .from("admissions_workflow_steps")
    .select("*")
    .eq("workflow_id", workflowId);

  if (steps?.length && draft) {
    await supabase.from("admissions_workflow_steps").insert(
      steps.map((s) => ({
        workflow_id: draft.id,
        step_order: s.step_order,
        step_type: s.step_type,
        action_type: s.action_type,
        config: s.config,
        is_active: s.is_active,
      }))
    );
  }

  revalidatePath("/dashboard/admissions/workflows");
  return { success: true, draftId: draft?.id };
}
