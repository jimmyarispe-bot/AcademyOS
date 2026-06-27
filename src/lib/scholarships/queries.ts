import { createAuthClient } from "@/lib/supabase/server-auth";
import { aggregateFundingReporting, fetchLeadFundingCodesByLeadIds } from "@/lib/funding/sync";

export interface ScholarshipApplicationRow {
  id: string;
  application_id: string;
  requested_amount: number | null;
  approved_amount: number | null;
  household_income: number | null;
  scholarship_status: string;
  review_notes: string | null;
  approver_name: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  admissions_applications?: {
    lead_id: string;
    admissions_leads?: {
      first_name: string;
      last_name: string;
      program: string | null;
      funding_sources: string[];
    } | null;
  } | null;
}

export interface ScholarshipDocument {
  id: string;
  scholarship_application_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}

function attachLeadFunding(
  row: Record<string, unknown>,
  fundingByLeadId: Map<string, string[]>
): ScholarshipApplicationRow {
  const apps = row.admissions_applications as ScholarshipApplicationRow["admissions_applications"];
  if (apps?.admissions_leads && apps.lead_id) {
    apps.admissions_leads = {
      ...apps.admissions_leads,
      funding_sources: fundingByLeadId.get(apps.lead_id) ?? [],
    };
  }
  return row as unknown as ScholarshipApplicationRow;
}

export async function getScholarshipApplications() {
  const supabase = await createAuthClient();
  const { data, error } = await supabase
    .from("scholarship_applications")
    .select(`
      *,
      admissions_applications(
        lead_id,
        admissions_leads(
          first_name,
          last_name,
          program
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[scholarships] getScholarshipApplications:", error.message);
    return [];
  }

  const rows = data ?? [];
  const leadIds = [
    ...new Set(
      rows
        .map(
          (row) =>
            (row as { admissions_applications?: { lead_id?: string } }).admissions_applications
              ?.lead_id
        )
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const fundingByLeadId = await fetchLeadFundingCodesByLeadIds(supabase, leadIds);

  return rows.map((row) =>
    attachLeadFunding(row as Record<string, unknown>, fundingByLeadId)
  );
}

export async function getScholarshipDocuments(applicationId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("scholarship_documents")
    .select("*")
    .eq("scholarship_application_id", applicationId)
    .order("created_at", { ascending: false });

  return (data ?? []) as ScholarshipDocument[];
}

export interface ScholarshipFundRow {
  id: string;
  school_id: string;
  fund_name: string;
  fund_type: string;
  donor_name: string | null;
  total_allocation: number;
  remaining_balance: number;
  restrictions: string | null;
  is_active: boolean;
}

export async function getScholarshipFunds() {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("scholarship_funds")
    .select("*")
    .order("name");

  return (data ?? []) as ScholarshipFundRow[];
}

export async function getApprovedScholarshipAwards() {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("scholarship_applications")
    .select(`
      id,
      approved_amount,
      remaining_award_balance,
      scholarship_status,
      scholarship_type,
      renewal_date,
      expires_on,
      conditions,
      student_id,
      students(first_name, last_name)
    `)
    .eq("scholarship_status", "approved")
    .order("approved_at", { ascending: false });

  return data ?? [];
}

export async function getScholarshipStats() {
  const apps = await getScholarshipApplications();
  const fundingReport = aggregateFundingReporting(
    apps.map((app) => ({
      funding_sources: app.admissions_applications?.admissions_leads?.funding_sources ?? [],
    }))
  );

  return {
    total: apps.length,
    pending: apps.filter((a) => ["submitted", "under_review"].includes(a.scholarship_status)).length,
    approved: apps.filter((a) => a.scholarship_status === "approved").length,
    denied: apps.filter((a) => a.scholarship_status === "denied").length,
    totalAwarded: apps
      .filter((a) => a.scholarship_status === "approved")
      .reduce((sum, a) => sum + Number(a.approved_amount ?? 0), 0),
    byFunding: fundingReport.byFunding,
    byCategory: fundingReport.byCategory,
  };
}

export async function getAdmissionsApplicationsForScholarship() {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_applications")
    .select("id, lead_id, admissions_leads(first_name, last_name)")
    .in("application_status", ["submitted", "under_review", "accepted"]);

  return data ?? [];
}
