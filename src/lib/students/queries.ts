import { createAuthClient } from "@/lib/supabase/server-auth";
import { aggregateFundingReporting, fetchStudentFundingCodesByStudentIds } from "@/lib/funding/sync";

export interface Family {

  id: string;

  school_id: string;

  family_name: string;

  primary_address: string | null;

  city: string | null;

  state: string | null;

  billing_email: string | null;

  status: string;

  schools?: { name: string } | null;

}



export interface StudentRecord {

  id: string;

  school_id: string;

  family_id: string | null;

  first_name: string;

  last_name: string;

  preferred_name: string | null;

  date_of_birth: string | null;

  grade_level: string | null;

  gender: string | null;

  program: string | null;

  enrollment_status: string;

  status: string;

  student_number: string | null;

  state_student_ids: { state: string; id: string }[] | unknown;

  photo_url: string | null;

  enrollment_start_date: string | null;

  enrollment_exit_date: string | null;

  graduation_year: number | null;

  admissions_lead_id: string | null;

  admissions_application_id: string | null;

  lifecycle_stage?: string | null;

  funding_sources: string[];

  schools?: { name: string } | null;

  campuses?: { name: string } | null;

  families?: { family_name: string } | null;

}



export interface GuardianRecord {

  id: string;

  family_id: string;

  first_name: string;

  last_name: string;

  email: string | null;

  phone: string | null;

  relationship_to_student: string | null;

  is_primary: boolean;

}



export interface SisEnrollment {

  id: string;

  student_id: string;

  school_year_id: string;

  program: string;

  enrollment_status: string;

  enrolled_at: string | null;

  school_years?: { name: string } | null;

}



function mapStudent(row: Record<string, unknown>, fundingSources: string[]): StudentRecord {
  return {
    ...(row as Omit<StudentRecord, "funding_sources">),
    funding_sources: fundingSources,
  };
}

export async function getStudents() {
  const supabase = await createAuthClient();
  const { data, error } = await supabase
    .from("students")
    .select("*, schools(name), campuses(name), families(family_name)")
    .order("last_name");

  if (error) {
    console.error("[students] getStudents:", error.message);
    return [];
  }

  const rows = data ?? [];
  const fundingByStudentId = await fetchStudentFundingCodesByStudentIds(
    supabase,
    rows.map((row) => row.id)
  );

  return rows.map((row) =>
    mapStudent(row as Record<string, unknown>, fundingByStudentId.get(row.id) ?? [])
  );
}

export async function getStudentById(id: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("students")
    .select("*, schools(name), campuses(name), families(family_name)")
    .eq("id", id)
    .single();

  if (!data) return null;

  const fundingByStudentId = await fetchStudentFundingCodesByStudentIds(supabase, [id]);
  return mapStudent(data as Record<string, unknown>, fundingByStudentId.get(id) ?? []);
}



export async function getFamilies() {

  const supabase = await createAuthClient();

  const { data } = await supabase

    .from("families")

    .select("*, schools(name)")

    .order("family_name");



  return (data ?? []) as Family[];

}



export async function getFamilyById(id: string) {

  const supabase = await createAuthClient();

  const { data } = await supabase

    .from("families")

    .select("*, schools(name)")

    .eq("id", id)

    .single();



  return data as Family | null;

}



export async function getGuardiansByFamily(familyId: string) {

  const supabase = await createAuthClient();

  const { data } = await supabase

    .from("guardians")

    .select("*")

    .eq("family_id", familyId)

    .order("is_primary", { ascending: false });



  return (data ?? []) as GuardianRecord[];

}



export async function getEnrollmentsByStudent(studentId: string) {

  const supabase = await createAuthClient();

  const { data } = await supabase

    .from("sis_enrollments")

    .select("*, school_years(name)")

    .eq("student_id", studentId)

    .order("enrolled_at", { ascending: false });



  return (data ?? []) as SisEnrollment[];

}



export async function getSchoolYears() {

  const supabase = await createAuthClient();

  const { data } = await supabase

    .from("school_years")

    .select("id, name, school_id, is_current")

    .order("name");



  return data ?? [];

}



export async function getSchools() {

  const supabase = await createAuthClient();

  const { data } = await supabase.from("schools").select("id, name").order("name");

  return data ?? [];

}



export async function getStudentStats() {

  const students = await getStudents();

  const fundingReport = aggregateFundingReporting(

    students.map((student) => ({ funding_sources: student.funding_sources }))

  );

  return {

    total: students.length,

    enrolled: students.filter((s) => s.enrollment_status === "enrolled").length,

    pending: students.filter((s) => s.enrollment_status === "pending").length,

    active: students.filter((s) => s.status === "active").length,

    byFunding: fundingReport.byFunding,

    byCategory: fundingReport.byCategory,

  };

}


