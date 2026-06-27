import { createAuthClient } from "@/lib/supabase/server-auth";

export interface FundingProgram {
  id: string;
  school_id: string | null;
  program_code: string;
  program_name: string;
  state_code: string;
  funding_agency: string;
  maximum_award: number | null;
  payment_schedule: string;
  renewal_rules: string | null;
  required_documents: string[];
  export_format: string;
  website: string | null;
  is_active: boolean;
}

export interface StateFundingAward {
  id: string;
  application_id: string;
  lead_id: string | null;
  student_id: string | null;
  funding_program_id: string | null;
  funding_source_code: string;
  state_code: string | null;
  award_amount: number | null;
  award_id: string | null;
  state_student_id: string | null;
  state_program_id: string | null;
  award_year: string | null;
  renewal_date: string | null;
  verification_status: string;
  verified_at: string | null;
  notes: string | null;
  funding_program_catalog?: FundingProgram | null;
  admissions_applications?: {
    lead_id: string;
    admissions_leads?: {
      first_name: string;
      last_name: string;
      applying_for_grade: string | null;
      guardian_first_name: string | null;
      guardian_last_name: string | null;
      guardian_email: string | null;
      schools?: { name: string } | null;
    } | null;
  } | null;
}

export async function getFundingProgramCatalog(schoolId?: string) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("funding_program_catalog")
    .select("*")
    .eq("is_active", true)
    .order("state_code")
    .order("program_name");

  if (schoolId) {
    query = query.or(`school_id.is.null,school_id.eq.${schoolId}`);
  }

  const { data } = await query;
  return (data ?? []).map((row) => ({
    ...(row as FundingProgram),
    required_documents: Array.isArray(row.required_documents)
      ? (row.required_documents as string[])
      : [],
  }));
}

export async function getStateFundingAwards(filters?: {
  state?: string;
  programId?: string;
  schoolId?: string;
  awardYear?: string;
  verificationStatus?: string;
}) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("state_funding_verifications")
    .select(`
      *,
      funding_program_catalog(*),
      admissions_applications(
        lead_id,
        admissions_leads(
          first_name, last_name, applying_for_grade,
          guardian_first_name, guardian_last_name, guardian_email,
          school_id, schools(name)
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (filters?.verificationStatus) {
    query = query.eq("verification_status", filters.verificationStatus);
  }
  if (filters?.state) {
    query = query.eq("state_code", filters.state);
  }
  if (filters?.programId) {
    query = query.eq("funding_program_id", filters.programId);
  }
  if (filters?.awardYear) {
    query = query.eq("award_year", filters.awardYear);
  }

  const { data } = await query;
  let rows = (data ?? []) as StateFundingAward[];

  if (filters?.schoolId) {
    rows = rows.filter(
      (r) =>
        (r.admissions_applications?.admissions_leads as { school_id?: string } | null)
          ?.school_id === filters.schoolId
    );
  }

  return rows;
}

export async function getReconciliationSummary() {
  const supabase = await createAuthClient();

  const [expectedResult, receivedResult] = await Promise.all([
    supabase.from("state_funding_expected_payments").select("expected_amount, school_id"),
    supabase.from("state_funding_received_payments").select("amount, school_id"),
  ]);

  const expectedTotal = (expectedResult.data ?? []).reduce(
    (s, r) => s + Number(r.expected_amount ?? 0),
    0
  );
  const receivedTotal = (receivedResult.data ?? []).reduce(
    (s, r) => s + Number(r.amount ?? 0),
    0
  );

  return {
    expectedTotal,
    receivedTotal,
    variance: receivedTotal - expectedTotal,
    shortage: Math.max(0, expectedTotal - receivedTotal),
    overpayment: Math.max(0, receivedTotal - expectedTotal),
  };
}

export async function getReconciliationByAward() {
  const supabase = await createAuthClient();

  const { data: awards } = await supabase
    .from("state_funding_verifications")
    .select(`
      id, award_amount, award_id, state_student_id, verification_status,
      admissions_applications(admissions_leads(first_name, last_name, schools(name)))
    `);

  const results = await Promise.all(
    (awards ?? []).map(async (award) => {
      const [expected, received] = await Promise.all([
        supabase
          .from("state_funding_expected_payments")
          .select("expected_amount")
          .eq("state_funding_verification_id", award.id),
        supabase
          .from("state_funding_received_payments")
          .select("amount")
          .eq("state_funding_verification_id", award.id),
      ]);

      const expectedSum = (expected.data ?? []).reduce(
        (s, r) => s + Number(r.expected_amount ?? 0),
        0
      );
      const receivedSum = (received.data ?? []).reduce(
        (s, r) => s + Number(r.amount ?? 0),
        0
      );
      const fallbackExpected = Number(award.award_amount ?? 0);

      return {
        id: award.id,
        studentName: (() => {
          const lead = (
            award.admissions_applications as {
              admissions_leads?: { first_name: string; last_name: string };
            } | null
          )?.admissions_leads;
          return lead ? `${lead.first_name} ${lead.last_name}` : "—";
        })(),
        expected: expectedSum || fallbackExpected,
        received: receivedSum,
        variance: receivedSum - (expectedSum || fallbackExpected),
      };
    })
  );

  return results;
}

export function buildFundingExportCsv(
  awards: StateFundingAward[]
): string {
  const headers = [
    "Student",
    "Parent",
    "Award ID",
    "State Student ID",
    "Award Amount",
    "School",
    "Grade",
    "Status",
    "State",
    "Program",
  ];

  const rows = awards.map((a) => {
    const lead = a.admissions_applications?.admissions_leads;
    return [
      lead ? `${lead.first_name} ${lead.last_name}` : "",
      lead
        ? `${lead.guardian_first_name ?? ""} ${lead.guardian_last_name ?? ""}`.trim()
        : "",
      a.award_id ?? a.state_program_id ?? "",
      a.state_student_id ?? "",
      a.award_amount ?? "",
      lead?.schools?.name ?? "",
      lead?.applying_for_grade ?? "",
      a.verification_status,
      a.state_code ?? "",
      a.funding_program_catalog?.program_name ?? a.funding_source_code,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
