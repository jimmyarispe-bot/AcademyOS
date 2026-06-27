import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function syncHrComplianceToMissionControl(supabase: AuthClient) {
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const in90Days = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];

  const { data: expiringCerts } = await supabase
    .from("employee_certifications")
    .select("*, employees(school_id, employee_profiles(first_name, last_name))")
    .eq("status", "active")
    .not("expiration_date", "is", null)
    .lte("expiration_date", in90Days)
    .gte("expiration_date", new Date().toISOString().split("T")[0]);

  for (const cert of expiringCerts ?? []) {
    const emp = cert.employees as {
      school_id: string;
      employee_profiles?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[];
    } | null;
    const profile = Array.isArray(emp?.employee_profiles) ? emp?.employee_profiles[0] : emp?.employee_profiles;
    const name = profile ? `${profile.first_name} ${profile.last_name}` : "Employee";
    const severity = cert.expiration_date <= in30Days ? "high" : "normal";

    await createMissionControlItem(supabase, {
      schoolId: emp?.school_id ?? "",
      module: "hr",
      itemType: "hr_alert",
      title: `Certification expiring: ${cert.certification_name}`,
      body: `${name} — expires ${cert.expiration_date}`,
      href: `/dashboard/hr/employees/${cert.employee_id}`,
      entityType: "employee_certifications",
      entityId: cert.id,
      assignedRole: "HR",
      severity,
    });
  }

  const { data: pendingOnboarding } = await supabase
    .from("hr_onboarding_tasks")
    .select("*, employees(school_id, employee_profiles(first_name, last_name))")
    .eq("status", "pending")
    .lt("due_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);

  for (const task of pendingOnboarding ?? []) {
    const emp = task.employees as { school_id: string } | null;
    await createMissionControlItem(supabase, {
      schoolId: emp?.school_id ?? "",
      module: "hr",
      itemType: "hr_alert",
      title: `Onboarding overdue: ${task.title}`,
      body: task.task_key,
      href: `/dashboard/hr/employees/${task.employee_id}`,
      entityType: "hr_onboarding_tasks",
      entityId: task.id,
      assignedRole: "HR",
      severity: "normal",
    });
  }

  const { data: pendingPayroll } = await supabase
    .from("payroll_records")
    .select("id, school_id, employees(employee_profiles(first_name, last_name))")
    .eq("pay_status", "pending")
    .limit(20);

  for (const pr of pendingPayroll ?? []) {
    await createMissionControlItem(supabase, {
      schoolId: pr.school_id,
      module: "hr",
      itemType: "hr_alert",
      title: "Payroll pending approval",
      body: "Payroll record awaiting processing",
      href: "/dashboard/hr?view=payroll",
      entityType: "payroll_records",
      entityId: pr.id,
      assignedRole: "FINANCE",
      severity: "normal",
    });
  }
}

export async function seedDefaultOnboardingTasks(supabase: AuthClient, employeeId: string) {
  const defaults = [
    { task_key: "policy_handbook", title: "Acknowledge employee handbook", category: "policy", requires_signature: true },
    { task_key: "technology_agreement", title: "Sign technology use agreement", category: "technology", requires_signature: true },
    { task_key: "emergency_contacts", title: "Confirm emergency contacts", category: "paperwork", requires_signature: false },
    { task_key: "credential_verification", title: "Submit credential verification", category: "credential", requires_signature: false },
    { task_key: "required_training", title: "Complete required safety training", category: "training", requires_signature: false },
  ];

  const due = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  await supabase.from("hr_onboarding_tasks").insert(
    defaults.map((d) => ({
      employee_id: employeeId,
      ...d,
      due_date: due,
    }))
  );
}
