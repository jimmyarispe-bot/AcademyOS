import { createAuthClient } from "@/lib/supabase/server-auth";

export { formatCount, formatCurrency } from "@/lib/format";

export interface DashboardMetrics {
  enrollment: number;
  activeStudents: number;
  admissionsPipeline: number;
  scholarshipsAwarded: number;
  employees: number;
  revenue: number;
}

const PIPELINE_STATUSES = [
  "new_inquiry",
  "information_sent",
  "tour_scheduled",
  "tour_completed",
  "application_started",
  "application_submitted",
  "records_requested",
  "admissions_review",
  "waitlisted",
] as const;

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createAuthClient();

  const [
    enrollmentResult,
    pipelineResult,
    scholarshipsResult,
    studentsResult,
    staffResult,
    revenueResult,
  ] = await Promise.all([
    supabase
      .from("student_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("enrollment_status", "enrolled"),
    supabase
      .from("admissions_leads")
      .select("*", { count: "exact", head: true })
      .in("lead_stage", [...PIPELINE_STATUSES]),
    supabase
      .from("scholarship_applications")
      .select("*", { count: "exact", head: true })
      .eq("scholarship_status", "approved"),
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("employment_status", "active"),
    supabase
      .from("payments")
      .select("amount"),
  ]);

  const revenueRows = revenueResult.data ?? [];
  const revenue = revenueRows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );

  return {
    enrollment: enrollmentResult.count ?? 0,
    activeStudents: studentsResult.count ?? 0,
    admissionsPipeline: pipelineResult.count ?? 0,
    scholarshipsAwarded: scholarshipsResult.count ?? 0,
    employees: staffResult.count ?? 0,
    revenue,
  };
}
