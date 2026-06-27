import type { FundingSourceValue } from "@/lib/constants/programs";
import { FUNDING_SOURCES, LEGACY_FUNDING_SOURCE_MAP } from "@/lib/constants/programs";

const VALID_FUNDING_CODES = new Set<string>(FUNDING_SOURCES.map((f) => f.value));

export function parseFundingSourcesFromForm(formData: FormData): FundingSourceValue[] {
  const raw = formData.getAll("funding_sources").map(String);
  const normalized = raw
    .map((code) => LEGACY_FUNDING_SOURCE_MAP[code] ?? code)
    .filter((code): code is FundingSourceValue => VALID_FUNDING_CODES.has(code));
  return [...new Set(normalized)];
}

export interface FundingSourceLink {
  funding_sources: { code: string; label: string; funding_source_category?: string } | null;
}

export function extractFundingCodes(links: FundingSourceLink[] | null | undefined): string[] {
  if (!links?.length) return [];
  return links
    .map((link) => link.funding_sources?.code)
    .filter((code): code is string => Boolean(code));
}
