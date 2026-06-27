import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { RiskItem } from "@/lib/executive/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getRiskRegister(supabase: AuthClient, schoolId?: string): Promise<RiskItem[]> {
  let query = supabase
    .from("executive_risk_register")
    .select("*")
    .in("status", ["open", "monitoring"])
    .order("risk_score", { ascending: false })
    .limit(50);

  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return (data ?? []) as RiskItem[];
}

/** Detect risks from operational data — no duplicate storage */
export async function detectOperationalRisks(supabase: AuthClient, schoolId?: string) {
  const risks: Omit<RiskItem, "id">[] = [];

  let atRiskQuery = supabase
    .from("student_growth_goals")
    .select("id, student_id, students(first_name, last_name, school_id)")
    .eq("status", "at_risk")
    .limit(20);
  const { data: atRiskGoals } = await atRiskQuery;

  for (const goal of atRiskGoals ?? []) {
    const st = Array.isArray(goal.students) ? goal.students[0] : goal.students;
    const sid = (st as { school_id?: string })?.school_id;
    if (schoolId && sid !== schoolId) continue;
    risks.push({
      risk_category: "student",
      title: `Student at academic risk: ${(st as { first_name?: string })?.first_name ?? "Student"}`,
      description: "Growth goal marked at risk",
      risk_score: 75,
      likelihood: "high",
      impact: "medium",
      status: "open",
      recommended_action: "Review intervention plan and schedule team meeting",
      due_date: null,
    });
  }

  let arQuery = supabase
    .from("family_billing_accounts")
    .select("id, school_id, collections_status, families(primary_guardian_name)")
    .in("collections_status", ["past_due", "collections"]);
  if (schoolId) arQuery = arQuery.eq("school_id", schoolId);
  const { data: pastDue } = await arQuery;

  for (const acct of pastDue ?? []) {
    risks.push({
      risk_category: "family_financial",
      title: `Family financial risk: ${(acct.families as { primary_guardian_name?: string })?.primary_guardian_name ?? "Family"}`,
      description: `Collections status: ${acct.collections_status}`,
      risk_score: acct.collections_status === "collections" ? 85 : 65,
      likelihood: "high",
      impact: "medium",
      status: "open",
      recommended_action: "Review payment plan and outreach",
      due_date: null,
    });
  }

  const { data: expiringCerts } = await supabase
    .from("employee_certifications")
    .select("id, certification_name, expiration_date, employee_id, employees(school_id)")
    .eq("status", "active")
    .lte("expiration_date", new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0])
    .limit(10);

  for (const cert of expiringCerts ?? []) {
    const emp = Array.isArray(cert.employees) ? cert.employees[0] : cert.employees;
    const sid = (emp as { school_id?: string })?.school_id;
    if (schoolId && sid !== schoolId) continue;
    risks.push({
      risk_category: "compliance",
      title: `Certification expiring: ${cert.certification_name}`,
      description: `Expires ${cert.expiration_date}`,
      risk_score: 70,
      likelihood: "medium",
      impact: "high",
      status: "open",
      recommended_action: "Verify renewal and schedule compliance review",
      due_date: cert.expiration_date,
    });
  }

  const { data: openJobs } = await supabase
    .from("hr_job_postings")
    .select("id, title, school_id")
    .eq("status", "open");
  const jobCount = schoolId
    ? (openJobs ?? []).filter((j) => j.school_id === schoolId).length
    : openJobs?.length ?? 0;
  if (jobCount >= 3) {
    risks.push({
      risk_category: "staffing",
      title: `${jobCount} open positions unfilled`,
      description: "Staffing shortage may impact program delivery",
      risk_score: 60,
      likelihood: "medium",
      impact: "high",
      status: "monitoring",
      recommended_action: "Review recruiting pipeline and substitute coverage",
      due_date: null,
    });
  }

  return risks;
}

export async function syncDetectedRisksToRegister(supabase: AuthClient, schoolId?: string) {
  const detected = await detectOperationalRisks(supabase, schoolId);
  for (const risk of detected.slice(0, 15)) {
    const { data: existing } = await supabase
      .from("executive_risk_register")
      .select("id")
      .eq("title", risk.title)
      .eq("status", "open")
      .maybeSingle();

    if (existing) continue;

    await supabase.from("executive_risk_register").insert({
      school_id: schoolId ?? null,
      ...risk,
    });
  }
}
