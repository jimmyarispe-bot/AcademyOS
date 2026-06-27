export const PROGRAMS = [
  { value: "academy_fl_campus", label: "Academy FL Campus" },
  { value: "academy_fl_virtual", label: "Academy FL Virtual" },
  { value: "academy_ga_campus", label: "Academy GA Campus" },
  { value: "academy_ga_hybrid", label: "Academy GA Hybrid" },
  { value: "academy_hs", label: "Academy High School" },
  { value: "academy_virtual", label: "Academy Virtual" },
] as const;

export type ProgramValue = (typeof PROGRAMS)[number]["value"];

export const FUNDING_SOURCE_CATEGORIES = [
  { value: "parent", label: "Parent" },
  { value: "scholarship", label: "Scholarship" },
  { value: "state_funding", label: "State Funding" },
  { value: "public_placement", label: "Public Placement" },
  { value: "government_program", label: "Government Program" },
  { value: "corporate", label: "Corporate" },
  { value: "other", label: "Other" },
] as const;

export type FundingSourceCategoryValue =
  (typeof FUNDING_SOURCE_CATEGORIES)[number]["value"];

export const FUNDING_SOURCES = [
  { value: "parent_pay", label: "Parent Pay", category: "parent" },
  { value: "family_scholarship", label: "Family Scholarship", category: "scholarship" },
  { value: "school_scholarship", label: "School Scholarship", category: "scholarship" },
  { value: "outside_scholarship", label: "Outside Scholarship", category: "scholarship" },
  { value: "esa", label: "ESA", category: "state_funding" },
  { value: "step_up_for_students", label: "Step Up For Students", category: "state_funding" },
  { value: "mckay_scholarship", label: "McKay Scholarship", category: "state_funding" },
  { value: "fes_ua", label: "FES-UA", category: "state_funding" },
  { value: "district_placement", label: "District Placement", category: "public_placement" },
  {
    value: "vocational_rehabilitation",
    label: "Vocational Rehabilitation",
    category: "government_program",
  },
  { value: "medicaid_waiver", label: "Medicaid Waiver", category: "government_program" },
  {
    value: "state_agency_placement",
    label: "State Agency Placement",
    category: "government_program",
  },
  { value: "grant_funded", label: "Grant Funded", category: "scholarship" },
  { value: "corporate_sponsorship", label: "Corporate Sponsorship", category: "corporate" },
  { value: "other", label: "Other", category: "other" },
] as const;

export type FundingSourceValue = (typeof FUNDING_SOURCES)[number]["value"];

const FUNDING_BY_VALUE = new Map(FUNDING_SOURCES.map((f) => [f.value, f]));

/** Maps legacy single-select funding_source column values to normalized codes. */
export const LEGACY_FUNDING_SOURCE_MAP: Record<string, FundingSourceValue> = {
  private_pay: "parent_pay",
  esa: "esa",
  voucher: "step_up_for_students",
  tax_credit_scholarship: "family_scholarship",
  school_scholarship: "school_scholarship",
};

export function programLabel(value: string | null | undefined): string {
  return PROGRAMS.find((p) => p.value === value)?.label ?? value ?? "—";
}

export function fundingSourceLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const mapped = LEGACY_FUNDING_SOURCE_MAP[value] ?? value;
  return FUNDING_BY_VALUE.get(mapped as FundingSourceValue)?.label ?? value;
}

export function fundingSourceCategory(
  value: string | null | undefined
): FundingSourceCategoryValue | null {
  if (!value) return null;
  const mapped = LEGACY_FUNDING_SOURCE_MAP[value] ?? value;
  return FUNDING_BY_VALUE.get(mapped as FundingSourceValue)?.category ?? null;
}

export function fundingSourceCategoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (value === "unassigned") return "Unassigned";
  return (
    FUNDING_SOURCE_CATEGORIES.find((c) => c.value === value)?.label ?? value
  );
}

export function fundingSourceLabels(values: string[] | null | undefined): string[] {
  if (!values?.length) return [];
  return values.map((v) => fundingSourceLabel(v));
}
