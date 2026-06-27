import { createAuthClient } from "@/lib/supabase/server-auth";
import type {
  Certification,
  EmployeeRecord,
  HrStats,
  PayrollRecord,
  Position,
} from "@/lib/hr/types";

export type {
  Certification,
  EmployeeRecord,
  HrStats,
  PayrollRecord,
  Position,
} from "@/lib/hr/types";

export function computeHrStats(
  employees: EmployeeRecord[],
  certifications: Certification[],
  payroll: PayrollRecord[]
): HrStats {
  const now = Date.now();
  const in90Days = now + 90 * 24 * 60 * 60 * 1000;

  return {
    activeEmployees: employees.filter((e) => e.employment_status === "active").length,
    totalEmployees: employees.length,
    expiringCerts: certifications.filter((c) => {
      if (!c.expiration_date || c.status !== "active") return false;
      const exp = Date.parse(c.expiration_date);
      return !Number.isNaN(exp) && exp <= in90Days;
    }).length,
    pendingPayroll: payroll.filter((p) => p.pay_status === "pending").length,
  };
}

export async function getEmployees(): Promise<EmployeeRecord[]> {
  const supabase = await createAuthClient();

  const extended = await supabase
    .from("employees")
    .select(
      "*, schools(name), employee_profiles(display_name, contact_email, job_title, first_name, last_name)"
    )
    .order("created_at", { ascending: false });

  if (!extended.error) {
    return (extended.data ?? []) as EmployeeRecord[];
  }

  const basic = await supabase
    .from("employees")
    .select("*, schools(name), employee_profiles(display_name, contact_email)")
    .order("created_at", { ascending: false });

  if (basic.error) {
    console.error("[hr] getEmployees:", basic.error.message);
    return [];
  }

  return (basic.data ?? []) as EmployeeRecord[];
}

export async function getPositions(): Promise<Position[]> {
  const supabase = await createAuthClient();
  const { data, error } = await supabase
    .from("positions")
    .select("*, schools(name)")
    .eq("status", "active")
    .order("title");

  if (error) {
    console.error("[hr] getPositions:", error.message);
    return [];
  }

  return (data ?? []) as Position[];
}

export async function getCertifications(): Promise<Certification[]> {
  const supabase = await createAuthClient();
  const { data, error } = await supabase
    .from("employee_certifications")
    .select("*")
    .order("expiration_date");

  if (error) {
    console.error("[hr] getCertifications:", error.message);
    return [];
  }

  return (data ?? []) as Certification[];
}

export async function getPayrollRecords(): Promise<PayrollRecord[]> {
  const supabase = await createAuthClient();
  const { data, error } = await supabase
    .from("payroll_records")
    .select("*, employees(employee_profiles(display_name))")
    .order("pay_period_end", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[hr] getPayrollRecords:", error.message);
    return [];
  }

  return (data ?? []) as PayrollRecord[];
}

export async function getSchools(): Promise<{ id: string; name: string }[]> {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.from("schools").select("id, name").order("name");

  if (error) {
    console.error("[hr] getSchools:", error.message);
    return [];
  }

  return data ?? [];
}

export async function getSubstitutes(schoolId?: string) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("substitute_pool_members")
    .select("*")
    .order("substitute_name");

  if (schoolId) query = query.eq("school_id", schoolId);

  const { data, error } = await query;
  if (error) {
    console.error("[hr] getSubstitutes:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getVolunteers(schoolId?: string) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("volunteers")
    .select("*")
    .order("last_name");

  if (schoolId) query = query.eq("school_id", schoolId);

  const { data, error } = await query;
  if (error) {
    console.error("[hr] getVolunteers:", error.message);
    return [];
  }
  return data ?? [];
}
