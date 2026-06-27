import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getSectionRevenue(
  supabase: AuthClient,
  sectionId: string,
  periodStart: string,
  periodEnd: string
) {
  const { data: enrollments } = await supabase
    .from("student_enrollments")
    .select("student_id, students(family_id)")
    .eq("course_section_id", sectionId)
    .eq("enrollment_status", "enrolled");

  const studentIds = (enrollments ?? []).map((e) => e.student_id);
  if (!studentIds.length) return { revenue: 0, scholarships: 0, stateFunding: 0, enrollment: 0 };

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total_amount, amount_paid, scholarship_credit, state_funding_credit, student_id")
    .in("student_id", studentIds)
    .gte("due_date", periodStart)
    .lte("due_date", periodEnd)
    .not("invoice_status", "eq", "void");

  const revenue = (invoices ?? []).reduce((s, i) => s + Number(i.total_amount), 0);
  const scholarships = (invoices ?? []).reduce((s, i) => s + Number(i.scholarship_credit ?? 0), 0);
  const stateFunding = (invoices ?? []).reduce((s, i) => s + Number(i.state_funding_credit ?? 0), 0);

  return {
    revenue,
    scholarships,
    stateFunding,
    enrollment: studentIds.length,
  };
}

export async function getProgramRevenue(
  supabase: AuthClient,
  schoolId: string,
  program: string,
  periodStart: string,
  periodEnd: string
) {
  const { data: invoices } = await supabase
    .from("invoices")
    .select(`
      total_amount, scholarship_credit, state_funding_credit, grant_credit,
      family_billing_accounts!inner(school_id)
    `)
    .eq("program", program)
    .eq("family_billing_accounts.school_id", schoolId)
    .gte("due_date", periodStart)
    .lte("due_date", periodEnd)
    .not("invoice_status", "eq", "void");

  return {
    revenue: (invoices ?? []).reduce((s, i) => s + Number(i.total_amount), 0),
    scholarships: (invoices ?? []).reduce((s, i) => s + Number(i.scholarship_credit ?? 0), 0),
    stateFunding: (invoices ?? []).reduce((s, i) => s + Number(i.state_funding_credit ?? 0), 0),
    grants: (invoices ?? []).reduce((s, i) => s + Number(i.grant_credit ?? 0), 0),
  };
}

export async function getStudentRevenue(supabase: AuthClient, studentId: string) {
  const [{ data: invoices }, { data: funding }, { data: scholarships }] = await Promise.all([
    supabase.from("invoices").select("total_amount, scholarship_credit, state_funding_credit, grant_credit, amount_paid").eq("student_id", studentId).not("invoice_status", "eq", "void"),
    supabase.from("ssis_student_funding_records").select("award_amount, funding_category").eq("student_id", studentId),
    supabase.from("scholarship_applications").select("approved_amount").eq("student_id", studentId).eq("scholarship_status", "approved"),
  ]);

  const tuition = (invoices ?? []).reduce((s, i) => s + Number(i.total_amount), 0);
  const scholarshipTotal = (invoices ?? []).reduce((s, i) => s + Number(i.scholarship_credit ?? 0), 0) +
    (scholarships ?? []).reduce((s, i) => s + Number(i.approved_amount ?? 0), 0);
  const stateFunding = (invoices ?? []).reduce((s, i) => s + Number(i.state_funding_credit ?? 0), 0);
  const esa = (funding ?? []).filter((f) => String(f.funding_category).includes("esa")).reduce((s, f) => s + Number(f.award_amount ?? 0), 0);
  const grants = (invoices ?? []).reduce((s, i) => s + Number(i.grant_credit ?? 0), 0);

  return { tuition, scholarships: scholarshipTotal, esa, stateFunding, grants, totalRevenue: tuition };
}
