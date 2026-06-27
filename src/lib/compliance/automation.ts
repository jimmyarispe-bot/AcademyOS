import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { registerComplianceObligation } from "@/lib/compliance/registry";
import { logComplianceAudit } from "@/lib/compliance/audit";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const today = () => new Date().toISOString().split("T")[0];

/** Sync deadlines from existing modules into the compliance engine (no duplicate reminders elsewhere) */
export async function syncModuleDeadlinesToCompliance(supabase: AuthClient) {
  const { syncUniversalDeadlines } = await import("@/lib/compliance/sync-deadlines");
  await syncUniversalDeadlines(supabase);
  await syncHrCertificationDeadlines(supabase);
  await syncExecutiveComplianceRequirements(supabase);
  await syncSpedReviewDeadlines(supabase);
}

async function syncHrCertificationDeadlines(supabase: AuthClient) {
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
  const { data: certs } = await supabase
    .from("employee_certifications")
    .select("id, certification_name, expiration_date, certification_type, employee_id, employees(school_id, user_id)")
    .eq("status", "active")
    .not("expiration_date", "is", null)
    .lte("expiration_date", in90);

  for (const cert of certs ?? []) {
    const emp = Array.isArray(cert.employees) ? cert.employees[0] : cert.employees;
    const typeKey = mapCertTypeToCategory(String(cert.certification_type ?? "other"));
    await registerComplianceObligation(supabase, {
      schoolId: (emp as { school_id?: string })?.school_id,
      categoryKey: typeKey,
      title: `Renew: ${cert.certification_name}`,
      description: `Employee certification expires ${cert.expiration_date}`,
      dueDate: cert.expiration_date!,
      frequency: "annual",
      riskLevel: cert.expiration_date! <= today() ? "critical" : "high",
      priority: "high",
      ownerUserId: (emp as { user_id?: string })?.user_id ?? null,
      sourceModule: "hr",
      sourceEntityType: "employee_certifications",
      sourceEntityId: cert.id,
    });
  }
}

async function syncExecutiveComplianceRequirements(supabase: AuthClient) {
  const { data: reqs } = await supabase
    .from("executive_compliance_requirements")
    .select("*")
    .in("status", ["pending", "in_progress", "overdue"]);

  for (const req of reqs ?? []) {
    const catKey = mapRequirementTypeToCategory(req.requirement_type);
    await registerComplianceObligation(supabase, {
      schoolId: req.school_id,
      categoryKey: catKey,
      title: req.title,
      description: req.description,
      dueDate: req.due_date ?? req.renewal_date ?? today(),
      ownerUserId: req.owner_user_id,
      sourceModule: "executive",
      sourceEntityType: "executive_compliance_requirements",
      sourceEntityId: req.id,
      riskLevel: req.status === "overdue" ? "critical" : "medium",
    });
  }
}

async function syncSpedReviewDeadlines(supabase: AuthClient) {
  const horizon = new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0];
  const { data: plans } = await supabase
    .from("student_special_education_plans")
    .select("id, student_id, plan_type, annual_review_date, reevaluation_date, students(school_id, first_name, last_name)")
    .eq("status", "active");

  for (const plan of plans ?? []) {
    const st = Array.isArray(plan.students) ? plan.students[0] : plan.students;
    const reviewDate = plan.annual_review_date ?? plan.reevaluation_date;
    if (!reviewDate || reviewDate > horizon) continue;

    const categoryKey = plan.plan_type === "504" ? "student_504" : "student_iep";
    await registerComplianceObligation(supabase, {
      schoolId: (st as { school_id?: string })?.school_id,
      categoryKey,
      title: `${plan.plan_type === "504" ? "504" : "IEP"} Review: ${(st as { first_name?: string })?.first_name ?? "Student"}`,
      dueDate: reviewDate,
      frequency: "annual",
      sourceModule: "sis",
      sourceEntityType: "student_special_education_plans",
      sourceEntityId: plan.id,
      riskLevel: "high",
    });
  }
}

function mapCertTypeToCategory(type: string): string {
  const map: Record<string, string> = {
    teaching_license: "hr_teaching_license",
    therapy_license: "hr_therapy_license",
    cpr: "hr_cpr",
    first_aid: "hr_first_aid",
    background_check: "hr_background_check",
    fingerprint: "hr_fingerprinting",
  };
  return map[type] ?? "hr_mandatory_training";
}

function mapRequirementTypeToCategory(type: string): string {
  const map: Record<string, string> = {
    accreditation: "accreditation",
    state_approval: "licensing_state",
    special_education: "student_iep",
    financial_audit: "finance_audit",
    hr_compliance: "hr_mandatory_training",
    safety: "facilities_security",
  };
  return map[type] ?? "governance";
}

export async function processComplianceRemindersAndEscalations(supabase: AuthClient) {
  const t = today();

  await supabase
    .from("compliance_obligations")
    .update({ status: "overdue" })
    .eq("status", "pending")
    .lt("due_date", t);

  const { data: schedules } = await supabase
    .from("compliance_reminder_schedules")
    .select("*")
    .eq("is_active", true);

  const defaultSchedule = schedules?.find((s) => s.is_default) ?? schedules?.[0];
  const daysBefore: number[] = defaultSchedule?.days_before ?? [30, 14, 7, 3, 1, 0];

  const { data: pending } = await supabase
    .from("compliance_obligations")
    .select("*")
    .in("status", ["pending", "overdue", "in_review"]);

  for (const ob of pending ?? []) {
    const due = new Date(ob.due_date);
    const now = new Date(t);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    const daysOverdue = daysUntil < 0 ? Math.abs(daysUntil) : 0;

    for (const days of daysBefore) {
      if (daysUntil === days || (days === 0 && daysUntil === 0)) {
        await sendComplianceReminder(supabase, ob, days);
      }
    }

    if (daysOverdue > 0 && defaultSchedule?.notify_daily_when_overdue) {
      await sendComplianceReminder(supabase, ob, -daysOverdue, true);
    }

    await processEscalations(supabase, ob, daysOverdue);
    await syncMissionControlForObligation(supabase, ob, daysUntil, daysOverdue);
  }

  await upsertDomainScores(supabase);
}

async function sendComplianceReminder(
  supabase: AuthClient,
  ob: Record<string, unknown>,
  daysBefore: number,
  isOverdueDaily = false
) {
  const reminderDate = today();
  const { data: existing } = await supabase
    .from("compliance_obligation_reminders")
    .select("id")
    .eq("obligation_id", ob.id as string)
    .eq("reminder_date", reminderDate)
    .eq("days_before", daysBefore)
    .maybeSingle();

  if (existing) return;

  await supabase.from("compliance_obligation_reminders").insert({
    obligation_id: ob.id as string,
    days_before: daysBefore,
    reminder_date: reminderDate,
    channel: "mission_control",
    recipient_user_id: ob.owner_user_id as string | null,
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  const title = isOverdueDaily
    ? `OVERDUE (${Math.abs(daysBefore)}d): ${ob.title}`
    : daysBefore === 0
      ? `Due today: ${ob.title}`
      : `Due in ${daysBefore} days: ${ob.title}`;

  await createMissionControlItem(supabase, {
    schoolId: ob.school_id as string | null,
    module:
      ob.assignee_type === "parent"
        ? "parent_portal"
        : ob.assignee_type === "student"
          ? "sis"
          : ob.assignee_type === "teacher"
            ? "teacher_portal"
            : "compliance",
    itemType: "compliance_alert",
    title,
    body: String(ob.description ?? ob.title),
    href: (ob.action_href as string | null) ?? `/dashboard/compliance?view=obligations`,
    entityType: "compliance_obligations",
    entityId: ob.id as string,
    assignedUserId: (ob.guardian_user_id as string | null) ?? (ob.owner_user_id as string | null),
    assignedRole: ob.owner_user_id ? undefined : ob.assignee_type === "teacher" ? "TEACHER" : "HR",
    severity: ob.risk_level === "critical" || isOverdueDaily ? "critical" : daysBefore <= 7 ? "high" : "normal",
  });
}

async function processEscalations(
  supabase: AuthClient,
  ob: Record<string, unknown>,
  daysOverdue: number
) {
  if (daysOverdue <= 0) return;

  const { data: rules } = await supabase
    .from("compliance_escalation_rules")
    .select("*")
    .eq("is_active", true)
    .lte("days_overdue", daysOverdue)
    .order("days_overdue", { ascending: false })
    .limit(1);

  const rule = rules?.[0];
  if (!rule) return;

  const { data: existing } = await supabase
    .from("compliance_obligation_escalations")
    .select("id")
    .eq("obligation_id", ob.id as string)
    .eq("days_overdue", rule.days_overdue)
    .maybeSingle();

  if (existing) return;

  await supabase.from("compliance_obligation_escalations").insert({
    obligation_id: ob.id as string,
    days_overdue: rule.days_overdue,
    escalated_to_role: rule.escalate_to_role,
  });

  await createMissionControlItem(supabase, {
    schoolId: ob.school_id as string | null,
    module: "executive",
    itemType: "escalation",
    title: `Escalation: ${ob.title}`,
    body: `${daysOverdue} days overdue — escalated to ${rule.escalate_to_role}`,
    href: `/dashboard/compliance?view=overdue`,
    entityType: "compliance_obligations",
    entityId: ob.id as string,
    assignedRole: rule.escalate_to_role,
    severity: rule.severity === "critical" ? "critical" : "high",
  });

  await logComplianceAudit(supabase, {
    obligationId: ob.id as string,
    schoolId: ob.school_id as string | null,
    actionType: "escalated",
    summary: `Escalated to ${rule.escalate_to_role} at ${daysOverdue} days overdue`,
  });
}

async function syncMissionControlForObligation(
  supabase: AuthClient,
  ob: Record<string, unknown>,
  daysUntil: number,
  daysOverdue: number
) {
  if (ob.risk_level !== "critical" && daysOverdue <= 0 && daysUntil > 30) return;

  const { data: docs } = await supabase
    .from("compliance_obligation_documents")
    .select("id")
    .eq("obligation_id", ob.id as string)
    .eq("is_required", true);

  const { data: requiredTypes } = await supabase
    .from("compliance_obligation_templates")
    .select("required_document_types")
    .eq("id", ob.template_id as string)
    .maybeSingle();

  const needsDocs = (requiredTypes?.required_document_types?.length ?? 0) > 0 && !(docs?.length);
  if (needsDocs && daysUntil <= 14) {
    await createMissionControlItem(supabase, {
      schoolId: ob.school_id as string | null,
      module: "executive",
      itemType: "executive_alert",
      title: `Missing documentation: ${ob.title}`,
      body: "Required documents not uploaded",
      href: `/dashboard/compliance?view=documents`,
      entityType: "compliance_obligations",
      entityId: ob.id as string,
      severity: "high",
    });
  }
}

async function upsertDomainScores(supabase: AuthClient) {
  const { data: schools } = await supabase.from("schools").select("id");
  for (const school of schools ?? []) {
    const { data: obligations } = await supabase
      .from("compliance_obligations")
      .select("status, due_date, compliance_categories(domain)")
      .eq("school_id", school.id)
      .not("status", "in", '("archived","cancelled","waived")');

    const byDomain: Record<string, { total: number; completed: number; overdue: number }> = {};
    const t = today();
    for (const ob of obligations ?? []) {
      const cat = ob.compliance_categories as { domain?: string } | null;
      const domain = cat?.domain ?? "general";
      if (!byDomain[domain]) byDomain[domain] = { total: 0, completed: 0, overdue: 0 };
      byDomain[domain].total++;
      if (ob.status === "completed") byDomain[domain].completed++;
      if (ob.status === "overdue" || (ob.status === "pending" && ob.due_date < t)) byDomain[domain].overdue++;
    }

    for (const [domain, stats] of Object.entries(byDomain)) {
      const score_pct = stats.total ? Math.round((stats.completed / stats.total) * 100) : 100;
      const status_indicator = score_pct >= 90 && stats.overdue === 0 ? "green" : score_pct >= 70 ? "yellow" : "red";
      await supabase.from("compliance_domain_scores").upsert(
        {
          school_id: school.id,
          score_date: t,
          domain,
          score_pct,
          status_indicator,
          total_obligations: stats.total,
          completed_obligations: stats.completed,
          overdue_obligations: stats.overdue,
        },
        { onConflict: "school_id,score_date,domain" }
      );
    }
  }
}

export async function syncComplianceToMissionControl(supabase: AuthClient) {
  await syncModuleDeadlinesToCompliance(supabase);
  await processComplianceRemindersAndEscalations(supabase);
}
