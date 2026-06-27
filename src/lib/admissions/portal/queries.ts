import { createAuthClient } from "@/lib/supabase/server-auth";
import { fetchLeadFundingCodesByLeadIds } from "@/lib/funding/sync";

export interface PortalApplication {
  id: string;
  lead_id: string;
  school_year_id: string;
  application_date: string;
  application_status: string;
  admissions_decision_date: string | null;
  previous_school: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  learning_needs_summary: string | null;
  submitted_at: string | null;
  lead_stage: string;
  admissions_leads?: {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    program: string | null;
    guardian_email: string | null;
    lead_stage: string;
    schools?: { name: string } | null;
  } | null;
  school_years?: { name: string } | null;
}

export interface PortalApplicationDocument {
  id: string;
  application_id: string;
  document_type: string;
  document_subtype: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  document_status: string;
  created_at: string;
}

export interface PortalStateFundingVerification {
  id: string;
  application_id: string;
  funding_source_code: string;
  state_program_id: string | null;
  verification_status: string;
  verified_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
}

export interface PortalScholarshipApplication {
  id: string;
  application_id: string;
  requested_amount: number | null;
  household_income: number | null;
  scholarship_status: string;
  submitted_at: string | null;
}

export interface PortalScholarshipDocument {
  id: string;
  scholarship_application_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}

export interface GuardianPortalLead {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  lead_stage: string;
  program: string | null;
  funding_sources: string[];
  schools?: { name: string } | null;
  applications: PortalApplication[];
}

const APPLICATION_SELECT = `
  *,
  admissions_leads(
    id,
    first_name,
    last_name,
    preferred_name,
    program,
    guardian_email,
    lead_stage,
    schools(name)
  ),
  school_years(name)
`;

export async function getSchoolsForInquiry() {
  const supabase = await createAuthClient();
  const { data } = await supabase.from("schools").select("id, name").order("name");
  return data ?? [];
}

export async function getCurrentSchoolYear(schoolId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("school_years")
    .select("id, name")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();

  return data;
}

export async function getGuardianPortalLeads(userEmail: string): Promise<GuardianPortalLead[]> {
  const supabase = await createAuthClient();
  const normalizedEmail = userEmail.trim().toLowerCase();

  const { data: guardianLinks } = await supabase
    .from("admissions_lead_guardians")
    .select("lead_id")
    .ilike("email", normalizedEmail);

  const leadIdsFromGuardians = guardianLinks?.map((g) => g.lead_id) ?? [];

  const { data: directLeads } = await supabase
    .from("admissions_leads")
    .select("id")
    .ilike("guardian_email", normalizedEmail);

  const leadIds = [
    ...new Set([
      ...leadIdsFromGuardians,
      ...(directLeads?.map((l) => l.id) ?? []),
    ]),
  ];

  if (leadIds.length === 0) return [];

  const { data: leads } = await supabase
    .from("admissions_leads")
    .select("*, schools(name)")
    .in("id", leadIds)
    .order("created_at", { ascending: false });

  if (!leads?.length) return [];

  const fundingByLeadId = await fetchLeadFundingCodesByLeadIds(supabase, leadIds);

  const { data: applications } = await supabase
    .from("admissions_applications")
    .select(APPLICATION_SELECT)
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });

  const appsByLead = (applications ?? []).reduce<Record<string, PortalApplication[]>>(
    (acc, app) => {
      const row = app as PortalApplication;
      const leadStage =
        row.admissions_leads?.lead_stage ?? "new_inquiry";
      const enriched = { ...row, lead_stage: leadStage };
      if (!acc[row.lead_id]) acc[row.lead_id] = [];
      acc[row.lead_id].push(enriched);
      return acc;
    },
    {}
  );

  return leads.map((lead) => ({
    ...(lead as Omit<GuardianPortalLead, "funding_sources" | "applications">),
    funding_sources: fundingByLeadId.get(lead.id) ?? [],
    applications: appsByLead[lead.id] ?? [],
  }));
}

export async function getPortalApplication(applicationId: string) {
  const supabase = await createAuthClient();

  const { data, error } = await supabase
    .from("admissions_applications")
    .select(APPLICATION_SELECT)
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as PortalApplication;
  const fundingByLeadId = await fetchLeadFundingCodesByLeadIds(supabase, [row.lead_id]);

  return {
    application: {
      ...row,
      lead_stage: row.admissions_leads?.lead_stage ?? "new_inquiry",
    },
    fundingCodes: fundingByLeadId.get(row.lead_id) ?? [],
  };
}

export async function getApplicationDocuments(applicationId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("application_documents")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  return (data ?? []) as PortalApplicationDocument[];
}

export async function getStateFundingVerifications(applicationId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("state_funding_verifications")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  return (data ?? []) as PortalStateFundingVerification[];
}

export async function getScholarshipForApplication(applicationId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("scholarship_applications")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle();

  return (data ?? null) as PortalScholarshipApplication | null;
}

export async function getScholarshipDocuments(scholarshipApplicationId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("scholarship_documents")
    .select("*")
    .eq("scholarship_application_id", scholarshipApplicationId)
    .order("created_at", { ascending: false });

  return (data ?? []) as PortalScholarshipDocument[];
}

export async function getLeadApplicationsForStaff(leadId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_applications")
    .select(APPLICATION_SELECT)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return (data ?? []) as PortalApplication[];
}
