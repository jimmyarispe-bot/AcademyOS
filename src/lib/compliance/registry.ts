import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ObligationFrequency, RegisterObligationInput } from "@/lib/compliance/types";
import { logComplianceAudit } from "@/lib/compliance/audit";
import { writeTimelineEvent } from "@/lib/platform/automation/timeline";
import { recordParentEngagementEvent } from "@/lib/ssis/engagement";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function assigneePayload(input: RegisterObligationInput) {
  return {
    assignee_type: input.assigneeType ?? "staff",
    student_id: input.studentId ?? null,
    family_id: input.familyId ?? null,
    employee_id: input.employeeId ?? null,
    guardian_user_id: input.guardianUserId ?? null,
    action_type: input.actionType ?? null,
    action_href: input.actionHref ?? null,
    parent_can_complete: input.parentCanComplete ?? input.assigneeType === "parent",
    subject_domain: input.subjectDomain ?? null,
  };
}

/** Universal deadline registration — modules call this instead of building their own reminders */
export async function registerComplianceObligation(
  supabase: AuthClient,
  input: RegisterObligationInput
) {
  const { data: category } = await supabase
    .from("compliance_categories")
    .select("id")
    .eq("category_key", input.categoryKey)
    .maybeSingle();

  const { data: existing } = await supabase
    .from("compliance_obligations")
    .select("id")
    .eq("source_module", input.sourceModule)
    .eq("source_entity_type", input.sourceEntityType)
    .eq("source_entity_id", input.sourceEntityId)
    .not("status", "in", '("completed","archived","cancelled")')
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("compliance_obligations")
      .update({
        title: input.title,
        description: input.description ?? null,
        due_date: input.dueDate,
        priority: input.priority ?? "normal",
        risk_level: input.riskLevel ?? "medium",
        owner_user_id: input.ownerUserId ?? null,
        metadata: input.metadata ?? {},
        ...assigneePayload(input),
        status: input.dueDate < new Date().toISOString().split("T")[0] ? "overdue" : "pending",
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: updated?.id, updated: true };
  }

  const { data: schedule } = await supabase
    .from("compliance_reminder_schedules")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();

  const { data, error } = await supabase
    .from("compliance_obligations")
    .insert({
      school_id: input.schoolId ?? null,
      campus_id: input.campusId ?? null,
      department: input.department ?? null,
      program: input.program ?? null,
      category_id: category?.id ?? null,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "normal",
      risk_level: input.riskLevel ?? "medium",
      frequency: input.frequency ?? "one_time",
      frequency_interval: input.frequencyInterval ?? null,
      rrule: input.rrule ?? null,
      due_date: input.dueDate,
      owner_user_id: input.ownerUserId ?? null,
      backup_owner_user_id: input.backupOwnerUserId ?? null,
      reviewer_user_id: input.reviewerUserId ?? null,
      approver_user_id: input.approverUserId ?? null,
      source_module: input.sourceModule,
      source_entity_type: input.sourceEntityType,
      source_entity_id: input.sourceEntityId,
      reminder_schedule_id: schedule?.id ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      ...assigneePayload(input),
      status: input.dueDate < new Date().toISOString().split("T")[0] ? "overdue" : "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logComplianceAudit(supabase, {
    obligationId: data.id,
    schoolId: input.schoolId,
    actionType: "registered",
    summary: `Obligation registered from ${input.sourceModule}`,
    afterState: { title: input.title, due_date: input.dueDate },
  });

  return { id: data.id, created: true };
}

export function computeNextDueDate(
  dueDate: string,
  frequency: ObligationFrequency,
  interval?: number | null
): string | null {
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return null;

  switch (frequency) {
    case "one_time":
      return null;
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semiannual":
      d.setMonth(d.getMonth() + 6);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "every_x_days":
      d.setDate(d.getDate() + (interval ?? 30));
      break;
    default:
      return null;
  }
  return d.toISOString().split("T")[0];
}

export async function completeObligationAndScheduleNext(
  supabase: AuthClient,
  obligationId: string,
  actorUserId?: string | null
) {
  const { data: ob } = await supabase
    .from("compliance_obligations")
    .select("*")
    .eq("id", obligationId)
    .single();

  if (!ob) return { error: "Not found" };

  const completionDate = new Date().toISOString().split("T")[0];
  await supabase
    .from("compliance_obligations")
    .update({ status: "completed", completion_date: completionDate })
    .eq("id", obligationId);

  await logComplianceAudit(supabase, {
    obligationId,
    schoolId: ob.school_id,
    actionType: "completed",
    summary: "Obligation marked completed",
    actorUserId,
    beforeState: { status: ob.status },
    afterState: { status: "completed", completion_date: completionDate },
  });

  await supabase
    .from("platform_mission_control_items")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("entity_type", "compliance_obligations")
    .eq("entity_id", obligationId)
    .eq("is_resolved", false);

  if (ob.student_id) {
    await writeTimelineEvent(supabase, {
      schoolId: ob.school_id,
      module: "compliance",
      entityType: "student",
      entityId: ob.student_id,
      eventType: "obligation_completed",
      title: `Completed: ${ob.title}`,
      body: ob.description ?? undefined,
      actorUserId,
      relatedEntityType: "compliance_obligations",
      relatedEntityId: obligationId,
    });
  }

  if (ob.assignee_type === "parent" && ob.student_id) {
    await recordParentEngagementEvent(supabase, {
      studentId: ob.student_id,
      familyId: ob.family_id,
      eventType: "obligation_completed",
      summary: `Completed deadline: ${ob.title}`,
      engagementScore: 3,
      metadata: { obligation_id: obligationId },
    });
  }

  const nextDue = computeNextDueDate(ob.due_date, ob.frequency as ObligationFrequency, ob.frequency_interval);
  if (!nextDue) return { success: true };

  await supabase.from("compliance_obligations").insert({
    school_id: ob.school_id,
    campus_id: ob.campus_id,
    department: ob.department,
    program: ob.program,
    category_id: ob.category_id,
    title: ob.title,
    description: ob.description,
    priority: ob.priority,
    risk_level: ob.risk_level,
    frequency: ob.frequency,
    frequency_interval: ob.frequency_interval,
    rrule: ob.rrule,
    due_date: nextDue,
    owner_user_id: ob.owner_user_id,
    backup_owner_user_id: ob.backup_owner_user_id,
    reviewer_user_id: ob.reviewer_user_id,
    approver_user_id: ob.approver_user_id,
    source_module: ob.source_module,
    source_entity_type: ob.source_entity_type,
    source_entity_id: ob.source_entity_id,
    parent_obligation_id: ob.id,
    occurrence_number: (ob.occurrence_number ?? 1) + 1,
    reminder_schedule_id: ob.reminder_schedule_id,
    assignee_type: ob.assignee_type,
    student_id: ob.student_id,
    family_id: ob.family_id,
    employee_id: ob.employee_id,
    guardian_user_id: ob.guardian_user_id,
    action_type: ob.action_type,
    action_href: ob.action_href,
    parent_can_complete: ob.parent_can_complete,
    subject_domain: ob.subject_domain,
    status: "pending",
  });

  return { success: true, nextDue };
}
