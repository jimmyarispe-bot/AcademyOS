"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePermission } from "@/lib/platform/identity/permissions";
import { writePlatformAudit } from "@/lib/platform/automation/audit";
import { completeObligationAndScheduleNext, registerComplianceObligation } from "@/lib/compliance/registry";
import type { ObligationFrequency } from "@/lib/compliance/types";
import { logComplianceAudit } from "@/lib/compliance/audit";
import { syncObligationToCalendar } from "@/lib/compliance/calendar";

async function assertManage() {
  const supabase = await createAuthClient();
  const gate = await requirePermission(supabase, "compliance.manage");
  if (!gate.ok) return { error: "Forbidden" as const };
  return { supabase };
}

async function assertAdmin() {
  const supabase = await createAuthClient();
  const gate = await requirePermission(supabase, "compliance.admin");
  if (!gate.ok) return { error: "Forbidden" as const };
  return { supabase };
}

export async function createObligationAction(formData: FormData) {
  const auth = await assertManage();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;
  const { data: { user } } = await supabase.auth.getUser();

  const schoolId = formData.get("school_id") as string;
  const categoryKey = formData.get("category_key") as string;

  const result = await registerComplianceObligation(supabase, {
    schoolId,
    categoryKey,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    dueDate: formData.get("due_date") as string,
    frequency: ((formData.get("frequency") as string) || "one_time") as ObligationFrequency,
    frequencyInterval: Number(formData.get("frequency_interval") || 0) || null,
    priority: (formData.get("priority") as string) || "normal",
    riskLevel: (formData.get("risk_level") as string) || "medium",
    ownerUserId: (formData.get("owner_user_id") as string) || user?.id || null,
    sourceModule: "compliance",
    sourceEntityType: "manual",
    sourceEntityId: crypto.randomUUID(),
  });

  if (result.error) return { error: result.error };
  if (result.id && schoolId) await syncObligationToCalendar(supabase, result.id, schoolId);

  revalidatePath("/dashboard/compliance");
  return { success: true, id: result.id };
}

export async function completeObligationAction(formData: FormData) {
  const auth = await assertManage();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;
  const { data: { user } } = await supabase.auth.getUser();
  const obligationId = formData.get("obligation_id") as string;

  const result = await completeObligationAndScheduleNext(supabase, obligationId, user?.id);
  if (result.error) return result;

  await writePlatformAudit(supabase, {
    module: "compliance",
    entityType: "compliance_obligations",
    entityId: obligationId,
    actionType: "obligation_completed",
    summary: "Compliance obligation completed",
    actorUserId: user?.id,
  });

  revalidatePath("/dashboard/compliance");
  return { success: true };
}

export async function completeObligationFormAction(formData: FormData) {
  await completeObligationAction(formData);
}

export async function registerDocumentAction(formData: FormData) {
  const auth = await assertManage();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("compliance_obligation_documents").insert({
    obligation_id: formData.get("obligation_id") as string,
    document_type: formData.get("document_type") as string,
    file_name: formData.get("file_name") as string,
    storage_path: formData.get("storage_path") as string,
    is_required: formData.get("is_required") === "true",
    uploaded_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  await logComplianceAudit(supabase, {
    obligationId: formData.get("obligation_id") as string,
    actionType: "document_uploaded",
    summary: `Document uploaded: ${formData.get("file_name")}`,
    actorUserId: user?.id,
  });

  revalidatePath("/dashboard/compliance");
  return { success: true };
}

export async function createCategoryAction(formData: FormData) {
  const auth = await assertAdmin();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;

  const key = (formData.get("category_key") as string).toLowerCase().replace(/\s+/g, "_");
  const { error } = await supabase.from("compliance_categories").insert({
    category_key: key,
    name: formData.get("name") as string,
    domain: (formData.get("domain") as string) || "general",
    is_system: false,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/compliance");
  return { success: true };
}

export async function saveReminderScheduleAction(formData: FormData) {
  const auth = await assertAdmin();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;

  const days = String(formData.get("days_before") ?? "")
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((n) => !Number.isNaN(n));

  const { error } = await supabase.from("compliance_reminder_schedules").insert({
    school_id: (formData.get("school_id") as string) || null,
    name: formData.get("name") as string,
    days_before: days.length ? days : [30, 14, 7, 3, 1, 0],
    notify_daily_when_overdue: formData.get("notify_daily_when_overdue") === "true",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/compliance");
  return { success: true };
}

export async function saveEscalationRuleAction(formData: FormData) {
  const auth = await assertAdmin();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;

  const { error } = await supabase.from("compliance_escalation_rules").insert({
    school_id: (formData.get("school_id") as string) || null,
    name: formData.get("name") as string,
    days_overdue: Number(formData.get("days_overdue")),
    escalate_to_role: formData.get("escalate_to_role") as string,
    severity: (formData.get("severity") as string) || "normal",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/compliance");
  return { success: true };
}
