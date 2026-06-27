import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getWorkforceAnalytics(supabase: AuthClient, schoolId?: string) {
  let employeesQuery = supabase.from("employees").select("id, employment_status, employee_type, department, program, school_id, hire_date, separation_date");
  if (schoolId) employeesQuery = employeesQuery.eq("school_id", schoolId);
  const { data: employees } = await employeesQuery;

  const list = employees ?? [];
  const active = list.filter((e) => e.employment_status === "active");
  const terminated = list.filter((e) => e.employment_status === "terminated");

  const byDepartment: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const e of active) {
    const dept = e.department ?? "Unassigned";
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1;
    byType[e.employee_type] = (byType[e.employee_type] ?? 0) + 1;
  }

  const { data: openJobs } = await supabase.from("hr_job_postings").select("id").eq("status", "open");
  const { data: expiringCerts } = await supabase
    .from("employee_certifications")
    .select("id")
    .eq("status", "active")
    .lte("expiration_date", new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0]);

  const { data: payrollYtd } = await supabase
    .from("payroll_records")
    .select("gross_pay, school_id")
    .gte("pay_period_start", `${new Date().getFullYear()}-01-01`);

  const payrollFiltered = schoolId
    ? (payrollYtd ?? []).filter((p) => p.school_id === schoolId)
    : payrollYtd ?? [];

  const { data: subs } = await supabase.from("substitute_assignments").select("id").gte("assigned_at", new Date(Date.now() - 30 * 86400000).toISOString());

  const turnoverRate = list.length
    ? Math.round((terminated.length / list.length) * 100)
    : 0;

  return {
    staffingLevels: active.length,
    vacancies: openJobs?.length ?? 0,
    turnoverRate,
    expiringCertifications: expiringCerts?.length ?? 0,
    payrollCostsYtd: payrollFiltered.reduce((s, p) => s + Number(p.gross_pay), 0),
    substituteUsage30d: subs?.length ?? 0,
    byDepartment,
    byEmployeeType: byType,
  };
}

export async function getOrgChart(supabase: AuthClient, schoolId: string) {
  const { data: employees } = await supabase
    .from("employees")
    .select(`
      id, supervisor_employee_id, department, program, employment_status,
      employee_profiles(first_name, last_name, job_title, campus_id)
    `)
    .eq("school_id", schoolId)
    .eq("employment_status", "active");

  const { data: positions } = await supabase
    .from("positions")
    .select("id, title, department, status")
    .eq("school_id", schoolId)
    .eq("status", "active");

  const nodes = (employees ?? []).map((e) => {
    const profile = Array.isArray(e.employee_profiles) ? e.employee_profiles[0] : e.employee_profiles;
    return {
      id: e.id,
      name: profile ? `${profile.first_name} ${profile.last_name}` : "Employee",
      title: profile?.job_title ?? "Staff",
      department: e.department,
      program: e.program,
      supervisorId: e.supervisor_employee_id,
    };
  });

  return { nodes, openPositions: positions ?? [] };
}
