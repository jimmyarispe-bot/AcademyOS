import { createAuthClient } from "@/lib/supabase/server-auth";
import type {
  AutomationAuditEntry,
  AutomationDashboardMetrics,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowQueueItem,
  WorkflowStep,
} from "@/lib/admissions/automation/types";

export async function getWorkflows(schoolId?: string) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("admissions_workflows")
    .select("*")
    .order("sort_order");

  if (schoolId) {
    query = query.or(`school_id.is.null,school_id.eq.${schoolId}`);
  }

  const { data } = await query;
  return (data ?? []) as WorkflowDefinition[];
}

export async function getWorkflowWithSteps(workflowId: string) {
  const supabase = await createAuthClient();
  const [workflow, steps] = await Promise.all([
    supabase.from("admissions_workflows").select("*").eq("id", workflowId).single(),
    supabase
      .from("admissions_workflow_steps")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("step_order"),
  ]);

  return {
    workflow: workflow.data as WorkflowDefinition | null,
    steps: (steps.data ?? []) as WorkflowStep[],
  };
}

export async function getAutomationDashboardMetrics(): Promise<AutomationDashboardMetrics> {
  const supabase = await createAuthClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [pending, failed, upcoming, completed, comms, leads] = await Promise.all([
    supabase
      .from("admissions_workflow_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("admissions_workflow_executions")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    supabase
      .from("admissions_workflow_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("scheduled_for", now.toISOString()),
    supabase
      .from("admissions_workflow_executions")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", todayStart),
    supabase.from("admissions_communications").select("delivery_status"),
    supabase.from("admissions_leads").select("inquiry_date, lead_stage"),
  ]);

  const deliveryLogged =
    comms.data?.filter((c) => c.delivery_status === "logged").length ?? 0;
  const deliverySent =
    comms.data?.filter((c) => c.delivery_status === "sent" || c.delivery_status === "delivered")
      .length ?? 0;

  const activeLeads = (leads.data ?? []).filter(
    (l) => !["enrolled", "declined"].includes(l.lead_stage)
  );
  const agingDays =
    activeLeads.length > 0
      ? Math.round(
          activeLeads.reduce((sum, l) => {
            const days = Math.floor(
              (now.getTime() - new Date(l.inquiry_date).getTime()) / 86400000
            );
            return sum + days;
          }, 0) / activeLeads.length
        )
      : null;

  return {
    pendingAutomations: pending.count ?? 0,
    failedAutomations: failed.count ?? 0,
    upcomingReminders: upcoming.count ?? 0,
    completedToday: completed.count ?? 0,
    avgResponseHours: null,
    applicationAgingDays: agingDays,
    deliveryLogged,
    deliverySent,
  };
}

export async function getRecentExecutions(limit = 20) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_workflow_executions")
    .select("*, admissions_workflows(name), admissions_leads(first_name, last_name)")
    .order("started_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as (WorkflowExecution & {
    admissions_workflows?: { name: string } | null;
    admissions_leads?: { first_name: string; last_name: string } | null;
  })[];
}

export async function getPendingWorkflowQueue(limit = 20) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_workflow_queue")
    .select("*")
    .in("status", ["pending", "processing", "failed"])
    .order("scheduled_for")
    .limit(limit);

  return (data ?? []) as WorkflowQueueItem[];
}

export async function getStaffAuditTimeline(leadId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_automation_audit_log")
    .select("*, users(full_name)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return (data ?? []) as AutomationAuditEntry[];
}

export async function searchApplicantTimeline(leadId: string, query: string) {
  const supabase = await createAuthClient();
  const q = query.toLowerCase();

  const [comms, audit, notes] = await Promise.all([
    supabase.from("admissions_communications").select("*").eq("lead_id", leadId),
    supabase.from("admissions_automation_audit_log").select("*").eq("lead_id", leadId),
    supabase.from("admissions_notes").select("*, users(full_name)").eq("lead_id", leadId),
  ]);

  const results: Array<{ type: string; title: string; body: string; timestamp: string }> = [];

  for (const c of comms.data ?? []) {
    const haystack = `${c.subject} ${c.body}`.toLowerCase();
    if (!q || haystack.includes(q)) {
      results.push({
        type: "communication",
        title: c.subject,
        body: c.body,
        timestamp: c.sent_at,
      });
    }
  }

  for (const a of audit.data ?? []) {
    const haystack = `${a.summary} ${JSON.stringify(a.details)}`.toLowerCase();
    if (!q || haystack.includes(q)) {
      results.push({
        type: "automation",
        title: a.summary,
        body: a.event_type,
        timestamp: a.created_at,
      });
    }
  }

  for (const n of notes.data ?? []) {
    const haystack = n.note_text.toLowerCase();
    if (!q || haystack.includes(q)) {
      results.push({
        type: "note",
        title: "Internal Note",
        body: n.note_text,
        timestamp: n.created_at,
      });
    }
  }

  return results.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function getTemplateVersions(templateId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_template_versions")
    .select("*, users(full_name)")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false });

  return data ?? [];
}
