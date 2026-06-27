import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getEmployeeProfile(supabase: AuthClient, employeeId: string) {
  const { data: employee } = await supabase
    .from("employees")
    .select("*, schools(name), employee_profiles(*)")
    .eq("id", employeeId)
    .single();

  if (!employee) return null;

  let supervisor = null;
  if (employee.supervisor_employee_id) {
    const { data: sup } = await supabase
      .from("employees")
      .select("id, employee_profiles(first_name, last_name, job_title)")
      .eq("id", employee.supervisor_employee_id)
      .single();
    supervisor = sup;
  }

  const [
    positions,
    certifications,
    serviceHistory,
    onboarding,
    timeEntries,
    leaveRequests,
    evaluations,
    training,
    documents,
    payroll,
  ] = await Promise.all([
    supabase.from("employee_positions").select("*, positions(title, department)").eq("employee_id", employeeId),
    supabase.from("employee_certifications").select("*").eq("employee_id", employeeId).order("expiration_date"),
    supabase.from("employee_service_history").select("*").eq("employee_id", employeeId).order("effective_date", { ascending: false }),
    supabase.from("hr_onboarding_tasks").select("*").eq("employee_id", employeeId),
    supabase.from("employee_time_entries").select("*").eq("employee_id", employeeId).order("entry_date", { ascending: false }).limit(20),
    supabase.from("leave_requests").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(10),
    supabase.from("performance_evaluations").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false }),
    supabase.from("employee_training_records").select("*").eq("employee_id", employeeId),
    supabase.from("employee_documents").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false }),
    supabase.from("payroll_records").select("*").eq("employee_id", employeeId).order("pay_period_end", { ascending: false }).limit(12),
  ]);

  return {
    employee,
    supervisor,
    positions: positions.data ?? [],
    certifications: certifications.data ?? [],
    serviceHistory: serviceHistory.data ?? [],
    onboarding: onboarding.data ?? [],
    timeEntries: timeEntries.data ?? [],
    leaveRequests: leaveRequests.data ?? [],
    evaluations: evaluations.data ?? [],
    training: training.data ?? [],
    documents: documents.data ?? [],
    payroll: payroll.data ?? [],
  };
}

export async function getRecruitingPipeline(supabase: AuthClient, schoolId?: string) {
  let jobsQuery = supabase.from("hr_job_postings").select("*").order("created_at", { ascending: false });
  if (schoolId) jobsQuery = jobsQuery.eq("school_id", schoolId);
  const { data: jobs } = await jobsQuery;

  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: applications } = jobIds.length
    ? await supabase.from("hr_job_applications").select("*").in("job_posting_id", jobIds).order("created_at", { ascending: false })
    : { data: [] };

  return { jobs: jobs ?? [], applications: applications ?? [] };
}

export async function getComplianceCenter(supabase: AuthClient, schoolId?: string) {
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];

  let certQuery = supabase
    .from("employee_certifications")
    .select("*, employees(school_id, employee_profiles(first_name, last_name))")
    .eq("status", "active")
    .not("expiration_date", "is", null)
    .lte("expiration_date", in90);

  const { data: expiringCerts } = await certQuery;
  const filteredCerts = schoolId
    ? (expiringCerts ?? []).filter((c) => (c.employees as { school_id?: string })?.school_id === schoolId)
    : expiringCerts ?? [];

  let onboardingQuery = supabase.from("hr_onboarding_tasks").select("*, employees(school_id)").neq("status", "completed");
  const { data: pendingOnboarding } = await onboardingQuery;
  const filteredOnboarding = schoolId
    ? (pendingOnboarding ?? []).filter((t) => (t.employees as { school_id?: string })?.school_id === schoolId)
    : pendingOnboarding ?? [];

  return {
    expiringCertifications: filteredCerts,
    pendingOnboarding: filteredOnboarding,
  };
}
