"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { writePlatformAudit } from "@/lib/platform/automation/audit";
import { allocatePayrollFromScheduling } from "@/lib/finance/payroll-allocation";
import { seedDefaultOnboardingTasks } from "@/lib/hr/automation";
import { recordFinancialTransaction } from "@/lib/finance/ledger";
import { requirePermission } from "@/lib/platform/identity/permissions";

async function assertHrManage() {
  const supabase = await createAuthClient();
  const gate = await requirePermission(supabase, "hr.manage");
  if (!gate.ok) return { error: "Forbidden" as const };
  return { supabase };
}

async function assertPayrollRun() {
  const supabase = await createAuthClient();
  const payrollGate = await requirePermission(supabase, "payroll.run");
  if (payrollGate.ok) return { supabase };
  const financeGate = await requirePermission(supabase, "finance.payroll");
  if (financeGate.ok) return { supabase };
  return { error: "Forbidden" as const };
}

export async function createEmployee(formData: FormData) {
  const auth = await assertHrManage();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("employees")
    .insert({
      school_id: formData.get("school_id") as string,
      employee_number: (formData.get("employee_number") as string) || null,
      employee_type: (formData.get("employee_type") as string) || "staff",
      employment_status: "active",
      hire_date: (formData.get("hire_date") as string) || null,
      department: (formData.get("department") as string) || null,
      program: (formData.get("program") as string) || null,
      supervisor_employee_id: (formData.get("supervisor_employee_id") as string) || null,
    })
    .select("id, school_id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("employee_profiles").insert({
    employee_id: data.id,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    display_name: `${formData.get("first_name")} ${formData.get("last_name")}`,
    contact_email: (formData.get("contact_email") as string) || null,
    contact_phone: (formData.get("contact_phone") as string) || null,
    job_title: (formData.get("job_title") as string) || null,
    meet_link: (formData.get("meet_link") as string) || null,
    emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
    emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
  });

  await supabase.from("employee_service_history").insert({
    employee_id: data.id,
    event_type: "hire",
    title: "Hired",
    effective_date: (formData.get("hire_date") as string) || new Date().toISOString().split("T")[0],
    recorded_by: user?.id ?? null,
  });

  await seedDefaultOnboardingTasks(supabase, data.id);

  await writePlatformAudit(supabase, {
    module: "hr",
    entityType: "employees",
    entityId: data.id,
    actionType: "employee_hired",
    summary: "New employee record created",
    actorUserId: user?.id,
    schoolId: data.school_id,
  });

  revalidatePath("/dashboard/hr");
  return { id: data.id };
}

export async function createPosition(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("positions").insert({
    school_id: formData.get("school_id") as string,
    title: formData.get("title") as string,
    department: (formData.get("department") as string) || null,
    employment_type: (formData.get("employment_type") as string) || "full_time",
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/hr");
  return { success: true };
}

export async function assignEmployeePositionAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("employee_positions").insert({
    employee_id: formData.get("employee_id") as string,
    position_id: formData.get("position_id") as string,
    is_primary: formData.get("is_primary") === "true",
    effective_from: (formData.get("effective_from") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/hr/employees/${formData.get("employee_id")}`);
  return { success: true };
}

export async function createCertification(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("employee_certifications").insert({
    employee_id: formData.get("employee_id") as string,
    certification_name: formData.get("certification_name") as string,
    certification_type: (formData.get("certification_type") as string) || null,
    issuing_body: (formData.get("issuing_body") as string) || null,
    certification_number: (formData.get("certification_number") as string) || null,
    issued_date: (formData.get("issued_date") as string) || null,
    expiration_date: (formData.get("expiration_date") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/hr");
  return { success: true };
}

export async function createPayrollRecord(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const grossPay = Number(formData.get("gross_pay")) || 0;
  const deductions = Number(formData.get("deductions")) || 0;
  const employeeId = formData.get("employee_id") as string;
  const schoolId = formData.get("school_id") as string;
  const periodStart = formData.get("pay_period_start") as string;
  const periodEnd = formData.get("pay_period_end") as string;

  const { data: record, error } = await supabase
    .from("payroll_records")
    .insert({
      school_id: schoolId,
      employee_id: employeeId,
      pay_period_start: periodStart,
      pay_period_end: periodEnd,
      gross_pay: grossPay,
      deductions,
      net_pay: grossPay - deductions,
      hours_worked: Number(formData.get("hours_worked")) || null,
      pay_status: "pending",
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/hr");
  return { success: true, id: record?.id };
}

export async function approvePayrollRecordAction(formData: FormData) {
  const auth = await assertPayrollRun();
  if ("error" in auth) return auth;
  const supabase = auth.supabase;
  const { data: { user } } = await supabase.auth.getUser();
  const payrollId = formData.get("payroll_id") as string;

  const { data: record } = await supabase
    .from("payroll_records")
    .select("*")
    .eq("id", payrollId)
    .single();

  if (!record) return { error: "Record not found" };

  await supabase
    .from("payroll_records")
    .update({ pay_status: "paid", paid_at: new Date().toISOString().split("T")[0] })
    .eq("id", payrollId);

  await allocatePayrollFromScheduling(supabase, {
    employeeId: record.employee_id,
    schoolId: record.school_id,
    payrollRecordId: payrollId,
    periodStart: record.pay_period_start,
    periodEnd: record.pay_period_end,
    totalAmount: Number(record.gross_pay),
  });

  await recordFinancialTransaction(supabase, {
    schoolId: record.school_id,
    sourceModule: "payroll",
    transactionType: "expense",
    category: "payroll",
    amount: Number(record.gross_pay),
    entityType: "payroll_records",
    entityId: payrollId,
    description: `Payroll ${record.pay_period_start}–${record.pay_period_end}`,
    createdBy: user?.id ?? null,
  });

  revalidatePath("/dashboard/hr");
  return { success: true };
}

export async function approvePayrollFormAction(formData: FormData) {
  await approvePayrollRecordAction(formData);
}

export async function createJobPostingAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("hr_job_postings").insert({
    school_id: formData.get("school_id") as string,
    title: formData.get("title") as string,
    department: (formData.get("department") as string) || null,
    employment_type: (formData.get("employment_type") as string) || "full_time",
    description: (formData.get("description") as string) || null,
    status: "open",
    posted_at: new Date().toISOString(),
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/hr");
  return { success: true };
}

export async function createJobApplicationAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("hr_job_applications").insert({
    job_posting_id: formData.get("job_posting_id") as string,
    candidate_name: formData.get("candidate_name") as string,
    candidate_email: formData.get("candidate_email") as string,
    candidate_phone: (formData.get("candidate_phone") as string) || null,
    resume_path: (formData.get("resume_path") as string) || null,
    pipeline_stage: "applied",
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/hr");
  return { success: true };
}

export async function updateApplicationStageAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase
    .from("hr_job_applications")
    .update({ pipeline_stage: formData.get("pipeline_stage") as string })
    .eq("id", formData.get("application_id") as string);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/hr");
  return { success: true };
}

export async function submitLeaveRequestAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("leave_requests").insert({
    employee_id: formData.get("employee_id") as string,
    school_id: formData.get("school_id") as string,
    leave_type: formData.get("leave_type") as string,
    start_date: formData.get("start_date") as string,
    end_date: formData.get("end_date") as string,
    hours_requested: Number(formData.get("hours_requested") || 0) || null,
    reason: (formData.get("reason") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/employee");
  revalidatePath("/dashboard/hr");
  return { success: true };
}

export async function completeOnboardingTaskAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase
    .from("hr_onboarding_tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", formData.get("task_id") as string);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/employee");
  revalidatePath("/dashboard/hr");
  return { success: true };
}

export async function registerEmployeeDocumentAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("employee_documents").insert({
    employee_id: formData.get("employee_id") as string,
    document_type: formData.get("document_type") as string,
    file_name: formData.get("file_name") as string,
    storage_path: formData.get("storage_path") as string,
    uploaded_by: user?.id ?? null,
    expires_at: (formData.get("expires_at") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/hr/employees/${formData.get("employee_id")}`);
  return { success: true };
}

export async function addSubstituteToPoolAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("substitute_pool_members").insert({
    school_id: formData.get("school_id") as string,
    substitute_name: formData.get("substitute_name") as string,
    contact_email: (formData.get("contact_email") as string) || null,
    contact_phone: (formData.get("contact_phone") as string) || null,
    credentials_verified: formData.get("credentials_verified") === "true",
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/hr");
  return { success: true };
}

export async function addVolunteerAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("volunteers").insert({
    school_id: formData.get("school_id") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    contact_email: (formData.get("contact_email") as string) || null,
    emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/hr");
  return { success: true };
}
