import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface AllocationRates {
  adminOverheadPct: number;
  technologyPct: number;
  facilityPct: number;
  insurancePct: number;
  marketingPct: number;
  curriculumPct: number;
  utilitiesPct: number;
  occupancyPct: number;
}

const DEFAULT_RATES: AllocationRates = {
  adminOverheadPct: 0.12,
  technologyPct: 0.08,
  facilityPct: 0.1,
  insurancePct: 0.03,
  marketingPct: 0.05,
  curriculumPct: 0.04,
  utilitiesPct: 0.02,
  occupancyPct: 0.06,
};

export async function getAllocationRates(supabase: AuthClient, schoolId?: string): Promise<AllocationRates> {
  let query = supabase.from("fi_allocation_rules").select("category, allocation_pct").eq("is_active", true);
  if (schoolId) {
    query = query.or(`school_id.is.null,school_id.eq.${schoolId}`);
  } else {
    query = query.is("school_id", null);
  }

  const { data } = await query;
  const rates = { ...DEFAULT_RATES };
  const categoryMap: Record<string, keyof AllocationRates> = {
    admin_overhead: "adminOverheadPct",
    technology: "technologyPct",
    facility: "facilityPct",
    insurance: "insurancePct",
    marketing: "marketingPct",
    curriculum: "curriculumPct",
    utilities: "utilitiesPct",
    occupancy: "occupancyPct",
  };

  for (const rule of data ?? []) {
    const key = categoryMap[rule.category];
    if (key) rates[key] = Number(rule.allocation_pct) / 100;
  }

  return rates;
}

export function allocateCosts(
  revenue: number,
  directCosts: number,
  instructionalHours: number,
  enrollment: number,
  rates: AllocationRates
) {
  const adminOverhead = revenue * rates.adminOverheadPct;
  const technologyCost = revenue * rates.technologyPct;
  const curriculumCost = revenue * rates.curriculumPct;
  const facilityCost = instructionalHours * 15 * rates.facilityPct;
  const marketingAllocation = revenue * rates.marketingPct;
  const insuranceAllocation = directCosts * rates.insurancePct;
  const utilitiesAllocation = revenue * rates.utilitiesPct;
  const occupancyAllocation = revenue * rates.occupancyPct;
  const sharedCosts = adminOverhead + technologyCost + curriculumCost + facilityCost +
    marketingAllocation + insuranceAllocation + utilitiesAllocation + occupancyAllocation;

  return {
    adminOverhead,
    technologyCost,
    curriculumCost,
    facilityCost,
    marketingAllocation,
    insuranceAllocation,
    utilitiesAllocation,
    occupancyAllocation,
    sharedCosts,
    totalCost: directCosts + sharedCosts,
  };
}

export function estimatePayrollCosts(grossPay: number) {
  const benefits = grossPay * 0.22;
  const payrollTaxes = grossPay * 0.0765;
  return { grossPay, benefits, payrollTaxes, total: grossPay + benefits + payrollTaxes };
}
