import {
  fundingSourceCategory,
  type FundingSourceCategoryValue,
} from "@/lib/constants/programs";
import type { FundingSourceValue } from "@/lib/constants/programs";
import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

async function getFundingSourceIds(
  supabase: AuthClient,
  codes: FundingSourceValue[]
): Promise<Map<FundingSourceValue, string>> {
  if (codes.length === 0) return new Map();

  const { data, error } = await supabase
    .from("funding_sources")
    .select("id, code")
    .in("code", codes);

  if (error) throw new Error(error.message);

  const map = new Map<FundingSourceValue, string>();
  for (const row of (data ?? []) as { id: string; code: string }[]) {
    map.set(row.code as FundingSourceValue, row.id);
  }
  return map;
}

export async function syncLeadFundingSources(
  supabase: AuthClient,
  leadId: string,
  codes: FundingSourceValue[]
) {
  const idMap = await getFundingSourceIds(supabase, codes);
  const fundingSourceIds = codes
    .map((code) => idMap.get(code))
    .filter((id): id is string => Boolean(id));

  const { error } = await supabase.rpc("replace_admissions_lead_funding_sources", {
    p_lead_id: leadId,
    p_funding_source_ids: fundingSourceIds,
  });

  if (error) throw new Error(error.message);
}

export async function syncStudentFundingSources(
  supabase: AuthClient,
  studentId: string,
  codes: FundingSourceValue[]
) {
  const idMap = await getFundingSourceIds(supabase, codes);
  const fundingSourceIds = codes
    .map((code) => idMap.get(code))
    .filter((id): id is string => Boolean(id));

  const { error } = await supabase.rpc("replace_student_funding_sources", {
    p_student_id: studentId,
    p_funding_source_ids: fundingSourceIds,
  });

  if (error) throw new Error(error.message);
}

/** Count entities per funding source code (multi-source entities counted in each). */
export function aggregateByFunding(
  items: { funding_sources: string[] }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item.funding_sources.length === 0) {
      counts.unassigned = (counts.unassigned ?? 0) + 1;
      continue;
    }
    for (const code of item.funding_sources) {
      counts[code] = (counts[code] ?? 0) + 1;
    }
  }
  return counts;
}

/** Count entities per funding category (deduped per entity within each category). */
export function aggregateByFundingCategory(
  items: { funding_sources: string[] }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const categories = new Set<FundingSourceCategoryValue>();
    for (const code of item.funding_sources) {
      const category = fundingSourceCategory(code);
      if (category) categories.add(category);
    }
    if (categories.size === 0) {
      counts.unassigned = (counts.unassigned ?? 0) + 1;
      continue;
    }
    for (const category of categories) {
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }
  return counts;
}

export function aggregateFundingReporting(items: { funding_sources: string[] }[]) {
  return {
    byFunding: aggregateByFunding(items),
    byCategory: aggregateByFundingCategory(items),
  };
}

export {
  fetchLeadFundingCodesByLeadIds,
  fetchStudentFundingCodesByStudentIds,
} from "@/lib/funding/queries";
