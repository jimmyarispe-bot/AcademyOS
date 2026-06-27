import { createAuthClient } from "@/lib/supabase/server-auth";

export interface DuplicateMatch {
  match_type: string;
  entity_type: string;
  entity_id: string;
  display_name: string;
  detail: string;
}

export async function detectDuplicates(input: {
  firstName: string;
  lastName: string;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  dateOfBirth?: string | null;
  excludeLeadId?: string | null;
}): Promise<DuplicateMatch[]> {
  const supabase = await createAuthClient();

  const { data, error } = await supabase.rpc("detect_admission_duplicates", {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_guardian_email: input.guardianEmail ?? null,
    p_guardian_phone: input.guardianPhone ?? null,
    p_date_of_birth: input.dateOfBirth ?? null,
    p_exclude_lead_id: input.excludeLeadId ?? null,
  });

  if (error) {
    console.error("[duplicates]", error.message);
    return [];
  }

  return (data ?? []) as DuplicateMatch[];
}
