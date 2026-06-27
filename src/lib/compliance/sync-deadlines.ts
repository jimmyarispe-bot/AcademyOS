import type { createAuthClient } from "@/lib/supabase/server-auth";
import { registerComplianceObligation } from "@/lib/compliance/registry";
import type { RegisterObligationInput } from "@/lib/compliance/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const today = () => new Date().toISOString().split("T")[0];
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split("T")[0];

async function primaryGuardianUserId(supabase: AuthClient, familyId: string | null | undefined) {
  if (!familyId) return null;
  const { data } = await supabase
    .from("guardians")
    .select("user_id")
    .eq("family_id", familyId)
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}

function computePaymentPlanNextDue(startDate: string, frequency: string, installmentCount: number): string {
  const start = new Date(startDate);
  const elapsed = Math.floor((Date.now() - start.getTime()) / 86400000);
  const intervalDays = frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 30;
  const paidInstallments = Math.min(installmentCount - 1, Math.floor(elapsed / intervalDays));
  const next = new Date(start);
  next.setDate(next.getDate() + (paidInstallments + 1) * intervalDays);
  return next.toISOString().split("T")[0];
}

async function registerParentObligation(
  supabase: AuthClient,
  input: Omit<RegisterObligationInput, "assigneeType" | "parentCanComplete"> & {
    familyId?: string | null;
    studentId?: string | null;
    guardianUserId?: string | null;
  }
) {
  const guardianUserId =
    input.guardianUserId ?? (await primaryGuardianUserId(supabase, input.familyId));
  await registerComplianceObligation(supabase, {
    ...input,
    assigneeType: "parent",
    parentCanComplete: true,
    guardianUserId,
    familyId: input.familyId ?? null,
    studentId: input.studentId ?? null,
  });
}

export async function syncParentDeadlines(supabase: AuthClient) {
  const horizon = inDays(90);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, due_date, invoice_number, total_amount, amount_paid, student_id, billing_account_id, family_billing_accounts(school_id, family_id)")
    .in("invoice_status", ["sent", "partial", "overdue"])
    .lte("due_date", horizon);

  for (const inv of invoices ?? []) {
    const acct = Array.isArray(inv.family_billing_accounts)
      ? inv.family_billing_accounts[0]
      : inv.family_billing_accounts;
    const balance = Number(inv.total_amount) - Number(inv.amount_paid);
    if (balance <= 0) continue;
    await registerParentObligation(supabase, {
      schoolId: (acct as { school_id?: string })?.school_id,
      familyId: (acct as { family_id?: string })?.family_id,
      studentId: inv.student_id,
      categoryKey: "parent_tuition_due",
      title: `Tuition due: ${inv.invoice_number}`,
      description: `Balance ${balance.toFixed(2)} due ${inv.due_date}`,
      dueDate: inv.due_date,
      actionType: "pay",
      actionHref: "/portal/finance",
      priority: inv.due_date <= today() ? "high" : "normal",
      riskLevel: inv.due_date <= today() ? "high" : "medium",
      sourceModule: "finance",
      sourceEntityType: "invoices",
      sourceEntityId: inv.id,
    });
  }

  const { data: plans } = await supabase
    .from("payment_plans")
    .select("id, name, start_date, frequency, installment_count, billing_account_id, family_billing_accounts(school_id, family_id)")
    .eq("status", "active");

  for (const plan of plans ?? []) {
    const acct = Array.isArray(plan.family_billing_accounts)
      ? plan.family_billing_accounts[0]
      : plan.family_billing_accounts;
    const nextDue = computePaymentPlanNextDue(plan.start_date, plan.frequency, plan.installment_count);
    if (nextDue > horizon) continue;
    await registerParentObligation(supabase, {
      schoolId: (acct as { school_id?: string })?.school_id,
      familyId: (acct as { family_id?: string })?.family_id,
      categoryKey: "parent_payment_plan",
      title: `Payment plan installment: ${plan.name}`,
      dueDate: nextDue,
      frequency: plan.frequency === "weekly" ? "weekly" : "monthly",
      actionType: "pay",
      actionHref: "/portal/finance",
      sourceModule: "finance",
      sourceEntityType: "payment_plans",
      sourceEntityId: plan.id,
    });
  }

  const { data: scholarships } = await supabase
    .from("scholarship_applications")
    .select("id, student_id, renewal_date, scholarship_type, students(school_id, family_id, first_name)")
    .eq("scholarship_status", "approved")
    .not("renewal_date", "is", null)
    .lte("renewal_date", horizon);

  for (const s of scholarships ?? []) {
    const st = Array.isArray(s.students) ? s.students[0] : s.students;
    await registerParentObligation(supabase, {
      schoolId: (st as { school_id?: string })?.school_id,
      familyId: (st as { family_id?: string })?.family_id,
      studentId: s.student_id,
      categoryKey: "parent_scholarship_renewal",
      title: `Scholarship renewal: ${(st as { first_name?: string })?.first_name ?? "student"}`,
      dueDate: s.renewal_date!,
      frequency: "annual",
      actionType: "upload",
      actionHref: "/portal/finance",
      sourceModule: "finance",
      sourceEntityType: "scholarship_applications",
      sourceEntityId: s.id,
    });
  }

  const { data: funding } = await supabase
    .from("ssis_student_funding_records")
    .select("id, student_id, funding_category, renewal_date, students(school_id, family_id, first_name)")
    .not("renewal_date", "is", null)
    .lte("renewal_date", horizon);

  for (const f of funding ?? []) {
    const st = Array.isArray(f.students) ? f.students[0] : f.students;
    const category = String(f.funding_category ?? "");
    const isEsa = category.includes("esa") || category.includes("voucher");
    await registerParentObligation(supabase, {
      schoolId: (st as { school_id?: string })?.school_id,
      familyId: (st as { family_id?: string })?.family_id,
      studentId: f.student_id,
      categoryKey: isEsa ? "parent_esa_voucher_renewal" : "parent_state_funding_renewal",
      title: `${isEsa ? "ESA/Voucher" : "State funding"} renewal`,
      dueDate: f.renewal_date!,
      frequency: "annual",
      actionType: "upload",
      actionHref: "/portal/documents",
      sourceModule: "sis",
      sourceEntityType: "ssis_student_funding_records",
      sourceEntityId: f.id,
    });
  }

  const { data: medicalAlerts } = await supabase
    .from("ssis_medical_expiry_alerts")
    .select("id, student_id, expires_on, alert_type, students(school_id, family_id, first_name)")
    .eq("is_resolved", false)
    .lte("expires_on", horizon);

  for (const alert of medicalAlerts ?? []) {
    const st = Array.isArray(alert.students) ? alert.students[0] : alert.students;
    const isImmunization = String(alert.alert_type ?? "").includes("immun");
    await registerParentObligation(supabase, {
      schoolId: (st as { school_id?: string })?.school_id,
      familyId: (st as { family_id?: string })?.family_id,
      studentId: alert.student_id,
      categoryKey: isImmunization ? "parent_immunization" : "parent_medical_form",
      title: `${isImmunization ? "Immunization" : "Medical form"} update: ${(st as { first_name?: string })?.first_name ?? "student"}`,
      dueDate: alert.expires_on,
      actionType: "upload",
      actionHref: "/portal/documents",
      sourceModule: "sis",
      sourceEntityType: "ssis_medical_expiry_alerts",
      sourceEntityId: alert.id,
    });
  }

  const { data: expiringDocs } = await supabase
    .from("student_documents")
    .select("id, student_id, document_type, expires_at, students(school_id, family_id, first_name)")
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lte("expires_at", horizon);

  for (const doc of expiringDocs ?? []) {
    const st = Array.isArray(doc.students) ? doc.students[0] : doc.students;
    const formMap: Record<string, string> = {
      handbook_acknowledgement: "parent_handbook_ack",
      technology_agreement: "parent_technology_agreement",
      media_release: "parent_media_release",
      insurance: "parent_insurance_info",
      emergency_contact: "parent_emergency_contact",
    };
    const categoryKey = formMap[doc.document_type] ?? "parent_enrollment_docs";
    await registerParentObligation(supabase, {
      schoolId: (st as { school_id?: string })?.school_id,
      familyId: (st as { family_id?: string })?.family_id,
      studentId: doc.student_id,
      categoryKey,
      title: `Update ${doc.document_type.replace(/_/g, " ")}`,
      dueDate: doc.expires_at!,
      actionType: "upload",
      actionHref: "/portal/documents",
      sourceModule: "sis",
      sourceEntityType: "student_documents",
      sourceEntityId: doc.id,
    });
  }

  const { data: forms } = await supabase
    .from("portal_form_templates")
    .select("id, title, school_id, form_type")
    .eq("is_active", true);

  const { data: activeStudents } = await supabase
    .from("students")
    .select("id, school_id, family_id")
    .eq("lifecycle_stage", "active");

  const yearStart = `${new Date().getFullYear()}-01-01`;
  for (const form of forms ?? []) {
    const studentsForSchool = (activeStudents ?? []).filter((s) => s.school_id === form.school_id);
    for (const student of studentsForSchool) {
      const { data: existing } = await supabase
        .from("portal_form_submissions")
        .select("id")
        .eq("template_id", form.id)
        .eq("family_id", student.family_id)
        .gte("submitted_at", yearStart)
        .limit(1);

      if (existing?.length || !student.family_id) continue;

      const formCategoryMap: Record<string, string> = {
        reenrollment: "parent_reenrollment",
        financial_aid: "parent_financial_aid",
        media_release: "parent_media_release",
        technology: "parent_technology_agreement",
        handbook: "parent_handbook_ack",
        transportation: "parent_enrollment_docs",
        volunteer: "parent_enrollment_docs",
      };
      await registerParentObligation(supabase, {
        schoolId: student.school_id,
        familyId: student.family_id,
        studentId: student.id,
        categoryKey: formCategoryMap[form.form_type] ?? "parent_enrollment_docs",
        title: `Complete: ${form.title}`,
        dueDate: inDays(30),
        actionType: "sign",
        actionHref: "/portal/forms",
        sourceModule: "portal",
        sourceEntityType: "portal_form_templates",
        sourceEntityId: `${form.id}:${student.id}`,
      });
    }
  }
}

export async function syncStudentDeadlines(supabase: AuthClient) {
  const horizon = inDays(60);

  const { data: goals } = await supabase
    .from("student_growth_goals")
    .select("id, student_id, title, review_date, goal_source, subject_domain, assigned_employee_id, students(school_id)")
    .in("status", ["active", "on_track", "at_risk"])
    .not("review_date", "is", null)
    .lte("review_date", horizon);

  const goalCategoryMap: Record<string, string> = {
    academic: "student_assignment",
    iep: "student_iep_goal",
    "504": "student_504_goal",
    intervention: "student_intervention_review",
    therapy: "student_therapy_practice",
    parent: "student_growth_plan",
    student: "student_growth_plan",
  };

  const domainCategoryMap: Record<string, string> = {
    reading: "student_reading_goal",
    writing: "student_writing_goal",
    math: "student_math_goal",
    structured_literacy: "student_literacy_checkpoint",
  };

  for (const goal of goals ?? []) {
    const st = Array.isArray(goal.students) ? goal.students[0] : goal.students;
    const categoryKey =
      (goal.subject_domain && domainCategoryMap[goal.subject_domain]) ||
      goalCategoryMap[goal.goal_source] ||
      "student_growth_plan";

    await registerComplianceObligation(supabase, {
      schoolId: (st as { school_id?: string })?.school_id,
      categoryKey,
      title: goal.title,
      dueDate: goal.review_date!,
      assigneeType: "student",
      studentId: goal.student_id,
      subjectDomain: goal.subject_domain,
      actionType: "complete",
      actionHref: "/portal/student/goals",
      sourceModule: "instruction",
      sourceEntityType: "student_growth_goals",
      sourceEntityId: goal.id,
    });
  }

  const { data: tasks } = await supabase
    .from("student_instructional_meeting_tasks")
    .select("id, title, due_date, meeting_id, student_instructional_meetings(student_id, students(school_id))")
    .eq("status", "open")
    .not("due_date", "is", null)
    .lte("due_date", horizon);

  for (const task of tasks ?? []) {
    const meeting = Array.isArray(task.student_instructional_meetings)
      ? task.student_instructional_meetings[0]
      : task.student_instructional_meetings;
    const st = meeting?.students
      ? Array.isArray(meeting.students)
        ? meeting.students[0]
        : meeting.students
      : null;
    if (!meeting?.student_id) continue;

    await registerComplianceObligation(supabase, {
      schoolId: (st as { school_id?: string })?.school_id,
      categoryKey: "student_assignment",
      title: task.title,
      dueDate: task.due_date!,
      assigneeType: "student",
      studentId: meeting.student_id,
      actionType: "complete",
      actionHref: "/portal/student",
      sourceModule: "instruction",
      sourceEntityType: "student_instructional_meeting_tasks",
      sourceEntityId: task.id,
    });
  }

  const { data: interventions } = await supabase
    .from("student_academic_interventions")
    .select("id, student_id, review_date, intervention_type, students(school_id)")
    .eq("status", "active")
    .not("review_date", "is", null)
    .lte("review_date", horizon);

  for (const iv of interventions ?? []) {
    const st = Array.isArray(iv.students) ? iv.students[0] : iv.students;
    await registerComplianceObligation(supabase, {
      schoolId: (st as { school_id?: string })?.school_id,
      categoryKey: "student_progress_monitoring",
      title: `Intervention review: ${iv.intervention_type}`,
      dueDate: iv.review_date!,
      assigneeType: "student",
      studentId: iv.student_id,
      actionType: "review",
      actionHref: "/portal/student/progress",
      sourceModule: "instruction",
      sourceEntityType: "student_academic_interventions",
      sourceEntityId: iv.id,
    });
  }
}

export async function syncTeacherDeadlines(supabase: AuthClient) {
  const t = today();
  const { start, end } = { start: `${t}T00:00:00`, end: `${t}T23:59:59` };

  const { data: sessions } = await supabase
    .from("instructional_sessions")
    .select("id, scheduled_end, instructor_employee_id, course_sections(section_code), employees(school_id, user_id)")
    .gte("scheduled_start", start)
    .lte("scheduled_start", end);

  for (const session of sessions ?? []) {
    const emp = Array.isArray(session.employees) ? session.employees[0] : session.employees;
    const cs = Array.isArray(session.course_sections) ? session.course_sections[0] : session.course_sections;
    const sectionCode = (cs as { section_code?: string })?.section_code ?? "session";

    const { count: attCount } = await supabase
      .from("session_attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("instructional_session_id", session.id);

    if (!attCount) {
      await registerComplianceObligation(supabase, {
        schoolId: (emp as { school_id?: string })?.school_id,
        categoryKey: "teacher_attendance",
        title: `Submit attendance — ${sectionCode}`,
        dueDate: t,
        assigneeType: "teacher",
        employeeId: session.instructor_employee_id,
        ownerUserId: (emp as { user_id?: string })?.user_id,
        actionType: "submit",
        actionHref: `/dashboard/teacher/sessions/${session.id}`,
        priority: new Date(session.scheduled_end) < new Date() ? "high" : "normal",
        sourceModule: "instruction",
        sourceEntityType: "instructional_sessions_attendance",
        sourceEntityId: session.id,
      });
    }

    const { data: delivery } = await supabase
      .from("instructional_session_deliveries")
      .select("lesson_status")
      .eq("instructional_session_id", session.id)
      .maybeSingle();

    if (delivery?.lesson_status !== "completed" && new Date(session.scheduled_end) < new Date()) {
      await registerComplianceObligation(supabase, {
        schoolId: (emp as { school_id?: string })?.school_id,
        categoryKey: "teacher_session_notes",
        title: `Session notes overdue — ${sectionCode}`,
        dueDate: t,
        assigneeType: "teacher",
        employeeId: session.instructor_employee_id,
        ownerUserId: (emp as { user_id?: string })?.user_id,
        actionType: "submit",
        actionHref: `/dashboard/teacher/sessions/${session.id}`,
        sourceModule: "instruction",
        sourceEntityType: "instructional_sessions_notes",
        sourceEntityId: session.id,
      });
    }
  }

  const { data: interventions } = await supabase
    .from("student_academic_interventions")
    .select("id, review_date, assigned_employee_id, intervention_type, employees(school_id, user_id)")
    .eq("status", "active")
    .not("review_date", "is", null)
    .lte("review_date", inDays(7));

  for (const iv of interventions ?? []) {
    const emp = Array.isArray(iv.employees) ? iv.employees[0] : iv.employees;
    if (!iv.assigned_employee_id) continue;
    await registerComplianceObligation(supabase, {
      schoolId: (emp as { school_id?: string })?.school_id,
      categoryKey: "teacher_progress_update",
      title: `Progress update due: ${iv.intervention_type}`,
      dueDate: iv.review_date!,
      assigneeType: "teacher",
      employeeId: iv.assigned_employee_id,
      ownerUserId: (emp as { user_id?: string })?.user_id,
      actionType: "submit",
      actionHref: "/dashboard/teacher?view=interventions",
      sourceModule: "instruction",
      sourceEntityType: "student_academic_interventions_teacher",
      sourceEntityId: iv.id,
    });
  }
}

export async function syncSchoolLeaderDeadlines(supabase: AuthClient) {
  const horizon = inDays(90);

  const { data: milestones } = await supabase
    .from("executive_strategic_milestones")
    .select("id, title, due_date, status, executive_strategic_initiatives(goal_id, executive_strategic_goals(school_id, owner_user_id))")
    .in("status", ["pending", "overdue"])
    .not("due_date", "is", null)
    .lte("due_date", horizon);

  for (const m of milestones ?? []) {
    const init = Array.isArray(m.executive_strategic_initiatives)
      ? m.executive_strategic_initiatives[0]
      : m.executive_strategic_initiatives;
    const goal = init?.executive_strategic_goals
      ? Array.isArray(init.executive_strategic_goals)
        ? init.executive_strategic_goals[0]
        : init.executive_strategic_goals
      : null;
    await registerComplianceObligation(supabase, {
      schoolId: (goal as { school_id?: string })?.school_id,
      categoryKey: "leader_strategic_milestone",
      title: m.title,
      dueDate: m.due_date!,
      assigneeType: "executive",
      ownerUserId: (goal as { owner_user_id?: string })?.owner_user_id,
      actionType: "review",
      actionHref: "/dashboard/executive/strategic",
      sourceModule: "executive",
      sourceEntityType: "executive_strategic_milestones",
      sourceEntityId: m.id,
    });
  }

  const { data: evals } = await supabase
    .from("performance_evaluations")
    .select("id, school_id, evaluation_period_end, evaluation_type, status, evaluator_user_id, employees(first_name, last_name)")
    .in("status", ["draft", "submitted"])
    .not("evaluation_period_end", "is", null)
    .lte("evaluation_period_end", horizon);

  for (const ev of evals ?? []) {
    const emp = Array.isArray(ev.employees) ? ev.employees[0] : ev.employees;
    await registerComplianceObligation(supabase, {
      schoolId: ev.school_id,
      categoryKey: "leader_employee_eval",
      title: `Complete evaluation: ${(emp as { first_name?: string })?.first_name ?? "employee"}`,
      dueDate: ev.evaluation_period_end!,
      assigneeType: "executive",
      ownerUserId: ev.evaluator_user_id,
      actionType: "review",
      actionHref: "/dashboard/hr?view=performance",
      sourceModule: "hr",
      sourceEntityType: "performance_evaluations",
      sourceEntityId: ev.id,
    });
  }

  const { data: reqs } = await supabase
    .from("executive_compliance_requirements")
    .select("id, school_id, title, due_date, status, owner_user_id")
    .in("status", ["pending", "in_progress", "overdue"])
    .not("due_date", "is", null)
    .lte("due_date", horizon);

  for (const req of reqs ?? []) {
    await registerComplianceObligation(supabase, {
      schoolId: req.school_id,
      categoryKey: "leader_compliance_approval",
      title: `Compliance approval: ${req.title}`,
      dueDate: req.due_date!,
      assigneeType: "executive",
      ownerUserId: req.owner_user_id,
      actionType: "review",
      actionHref: "/dashboard/executive/compliance",
      sourceModule: "executive",
      sourceEntityType: "executive_compliance_requirements_leader",
      sourceEntityId: req.id,
    });
  }
}

export async function syncUniversalDeadlines(supabase: AuthClient) {
  await syncParentDeadlines(supabase);
  await syncStudentDeadlines(supabase);
  await syncTeacherDeadlines(supabase);
  await syncSchoolLeaderDeadlines(supabase);
}
