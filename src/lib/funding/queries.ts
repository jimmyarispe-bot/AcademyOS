import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

interface LeadFundingLinkRow {
  lead_id: string;
  funding_source_id: string;
}

interface StudentFundingLinkRow {
  student_id: string;
  funding_source_id: string;
}

interface FundingSourceRow {
  id: string;
  code: string;
}

async function listLeadFundingLinks(
  supabase: AuthClient,
  leadIds: string[]
): Promise<LeadFundingLinkRow[]> {
  if (leadIds.length === 0) return [];

  const rpc = await supabase.rpc(
    "list_admissions_lead_funding_sources",
    {
      p_lead_ids: leadIds,
    }
  );

  if (rpc.error) {
    console.error(
      "[funding] RPC ERROR:",
      JSON.stringify(rpc.error, null, 2)
    );
    return [];
  }

  return (rpc.data ?? []) as LeadFundingLinkRow[];
}

async function listStudentFundingLinks(
  supabase: AuthClient,
  studentIds: string[]
): Promise<StudentFundingLinkRow[]> {
  if (studentIds.length === 0) return [];

  const rpc = await supabase.rpc(
    "list_student_funding_sources",
    {
      p_student_ids: studentIds,
    }
  );

  if (rpc.error) {
    console.error(
      "[funding] RPC ERROR:",
      JSON.stringify(rpc.error, null, 2)
    );
    return [];
  }

  return (rpc.data ?? []) as StudentFundingLinkRow[];
}

async function loadFundingCodesByIds(
  supabase: AuthClient,
  fundingSourceIds: string[]
): Promise<Map<string, string>> {
  const codeById = new Map<string, string>();

  if (fundingSourceIds.length === 0) {
    return codeById;
  }

  const { data, error } = await supabase
    .from("funding_sources")
    .select("id, code")
    .in("id", fundingSourceIds);

  if (error) {
    console.error("[funding] loadFundingCodesByIds:", error.message);
    return codeById;
  }

  for (const row of (data ?? []) as FundingSourceRow[]) {
    codeById.set(row.id, row.code);
  }

  return codeById;
}

export async function fetchLeadFundingCodesByLeadIds(
  supabase: AuthClient,
  leadIds: string[]
): Promise<Map<string, string[]>> {
  const links = await listLeadFundingLinks(supabase, leadIds);

  const fundingSourceIds = [
    ...new Set(links.map((x) => x.funding_source_id)),
  ];

  const codeById = await loadFundingCodesByIds(
    supabase,
    fundingSourceIds
  );

  const result = new Map<string, string[]>();

  for (const leadId of leadIds) {
    result.set(leadId, []);
  }

  for (const link of links) {
    const code = codeById.get(link.funding_source_id);

    if (!code) continue;

    result.get(link.lead_id)?.push(code);
  }

  return result;
}

export async function fetchStudentFundingCodesByStudentIds(
  supabase: AuthClient,
  studentIds: string[]
): Promise<Map<string, string[]>> {
  const links = await listStudentFundingLinks(
    supabase,
    studentIds
  );

  const fundingSourceIds = [
    ...new Set(links.map((x) => x.funding_source_id)),
  ];

  const codeById = await loadFundingCodesByIds(
    supabase,
    fundingSourceIds
  );

  const result = new Map<string, string[]>();

  for (const studentId of studentIds) {
    result.set(studentId, []);
  }

  for (const link of links) {
    const code = codeById.get(link.funding_source_id);

    if (!code) continue;

    result.get(link.student_id)?.push(code);
  }

  return result;
}