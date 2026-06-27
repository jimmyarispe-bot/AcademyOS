import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function syncStudentFundingRecords(
  supabase: AuthClient,
  studentId: string,
  applicationId?: string | null
) {
  const { data: student } = await supabase
    .from("students")
    .select("id, admissions_lead_id, admissions_application_id")
    .eq("id", studentId)
    .single();

  if (!student) return;

  const appId = applicationId ?? student.admissions_application_id;
  const leadId = student.admissions_lead_id;

  if (leadId) {
    const { data: leadFunding } = await supabase
      .from("admissions_lead_funding_sources")
      .select("funding_source_id, funding_sources(code, label)")
      .eq("lead_id", leadId);

    for (const row of leadFunding ?? []) {
      const fs = Array.isArray(row.funding_sources) ? row.funding_sources[0] : row.funding_sources;
      const code = (fs as { code?: string })?.code ?? "other";
      const { data: existing } = await supabase
        .from("ssis_student_funding_records")
        .select("id")
        .eq("student_id", studentId)
        .eq("funding_category", mapFundingCategory(code))
        .is("source_entity_id", null)
        .maybeSingle();
      if (existing) continue;

      await supabase.from("ssis_student_funding_records").insert({
        student_id: studentId,
        funding_category: mapFundingCategory(code),
        program_name: (fs as { label?: string })?.label ?? code,
        verification_status: "verified",
        metadata: { source: "admissions_lead", funding_source_id: row.funding_source_id },
      });
    }
  }

  if (appId) {
    const { data: stateFunding } = await supabase
      .from("state_funding_verifications")
      .select("*")
      .eq("application_id", appId);

    for (const sf of stateFunding ?? []) {
      await supabase.from("ssis_student_funding_records").insert({
        student_id: studentId,
        funding_category: "state_funding",
        source_entity_type: "state_funding_verifications",
        source_entity_id: sf.id,
        program_name: sf.funding_source_code,
        state_code: sf.state_code,
        award_amount: sf.award_amount,
        award_year: sf.award_year,
        verification_status: sf.verification_status ?? "pending",
        renewal_date: sf.renewal_date,
        metadata: { state_student_id: sf.state_student_id },
      });
    }

    const { data: scholarships } = await supabase
      .from("scholarship_applications")
      .select("id, scholarship_status, requested_amount, approved_amount")
      .eq("application_id", appId);

    for (const sch of scholarships ?? []) {
      await supabase.from("ssis_student_funding_records").insert({
        student_id: studentId,
        funding_category: "school_scholarship",
        source_entity_type: "scholarship_applications",
        source_entity_id: sch.id,
        program_name: "School Scholarship",
        award_amount: sch.approved_amount ?? sch.requested_amount,
        verification_status: sch.scholarship_status === "approved" ? "verified" : "pending",
        payment_status: sch.scholarship_status === "approved" ? "expected" : "unknown",
        metadata: { scholarship_status: sch.scholarship_status },
      });
    }
  }
}

function mapFundingCategory(code: string): string {
  const map: Record<string, string> = {
    esa: "esa_voucher",
    step_up_for_students: "state_funding",
    mckay_scholarship: "state_funding",
    fes_ua: "state_funding",
    school_scholarship: "school_scholarship",
    outside_scholarship: "outside_scholarship",
    grant_funded: "grant",
    parent_pay: "parent_pay",
  };
  return map[code] ?? "other";
}

export function buildSsissFundingExportCsv(
  records: Array<Record<string, unknown>>,
  students: Map<string, Record<string, unknown>>
): string {
  const headers = [
    "Student Number",
    "Student Name",
    "Program",
    "Funding Category",
    "State Code",
    "Award Amount",
    "Verification Status",
    "Payment Status",
    "Renewal Date",
  ];
  const rows = records.map((r) => {
    const student = students.get(String(r.student_id));
    return [
      student?.student_number ?? "",
      student ? `${student.first_name} ${student.last_name}` : "",
      student?.program ?? r.program_name ?? "",
      r.funding_category,
      r.state_code ?? "",
      r.award_amount ?? "",
      r.verification_status,
      r.payment_status,
      r.renewal_date ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

export async function getSsissFundingExportData(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  filters?: { schoolId?: string; stateCode?: string; program?: string; category?: string }
) {
  let query = supabase.from("ssis_student_funding_records").select("*").order("created_at", { ascending: false });

  if (filters?.stateCode) query = query.eq("state_code", filters.stateCode);
  if (filters?.category) query = query.eq("funding_category", filters.category);
  if (filters?.program) query = query.ilike("program_name", `%${filters.program}%`);

  const { data: records } = await query;
  const list = records ?? [];
  const studentIds = [...new Set(list.map((r) => r.student_id))];

  let studentQuery = supabase
    .from("students")
    .select("id, first_name, last_name, student_number, program, school_id")
    .in("id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  if (filters?.schoolId) studentQuery = studentQuery.eq("school_id", filters.schoolId);

  const { data: students } = await studentQuery;
  const studentMap = new Map((students ?? []).map((s) => [s.id, s as Record<string, unknown>]));

  const filtered = filters?.schoolId
    ? list.filter((r) => studentMap.has(r.student_id))
    : list;

  return { records: filtered, studentMap };
}

export async function getStudentFundingCenter(supabase: AuthClient, studentId: string) {
  const { data } = await supabase
    .from("ssis_student_funding_records")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
