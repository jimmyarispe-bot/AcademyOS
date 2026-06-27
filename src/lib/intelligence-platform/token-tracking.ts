import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { CostSummary } from "@/lib/intelligence-platform/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function recordTokenUsage(
  supabase: AuthClient,
  input: {
    organizationId: string;
    schoolId?: string;
    userId?: string;
    module: string;
    promptId?: string;
    providerKey?: string;
    jobId?: string;
    tokensIn: number;
    tokensOut: number;
    estimatedCostUsd?: number;
    executionTimeMs?: number;
    status?: string;
  }
) {
  await supabase.from("aip_token_usage").insert({
    organization_id: input.organizationId,
    school_id: input.schoolId ?? null,
    user_id: input.userId ?? null,
    module: input.module,
    prompt_id: input.promptId ?? null,
    provider_key: input.providerKey ?? null,
    job_id: input.jobId ?? null,
    tokens_in: input.tokensIn,
    tokens_out: input.tokensOut,
    estimated_cost_usd: input.estimatedCostUsd ?? 0,
    execution_time_ms: input.executionTimeMs ?? null,
    status: input.status ?? "simulated",
  });
}

export async function getCostSummary(supabase: AuthClient, organizationId: string): Promise<CostSummary> {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const { data: daily } = await supabase
    .from("aip_token_usage")
    .select("estimated_cost_usd")
    .eq("organization_id", organizationId)
    .eq("usage_date", today);

  const { data: monthly } = await supabase
    .from("aip_token_usage")
    .select("estimated_cost_usd, module, prompt_id, tokens_in, tokens_out")
    .eq("organization_id", organizationId)
    .gte("usage_date", monthStart);

  const dailyCost = (daily ?? []).reduce((s, r) => s + Number(r.estimated_cost_usd ?? 0), 0);
  const monthlyCost = (monthly ?? []).reduce((s, r) => s + Number(r.estimated_cost_usd ?? 0), 0);

  const moduleMap = new Map<string, { cost: number; tokens: number }>();
  const promptMap = new Map<string, number>();

  for (const row of monthly ?? []) {
    const mod = row.module ?? "unknown";
    const existing = moduleMap.get(mod) ?? { cost: 0, tokens: 0 };
    moduleMap.set(mod, {
      cost: existing.cost + Number(row.estimated_cost_usd ?? 0),
      tokens: existing.tokens + (row.tokens_in ?? 0) + (row.tokens_out ?? 0),
    });
    if (row.prompt_id) {
      promptMap.set(row.prompt_id, (promptMap.get(row.prompt_id) ?? 0) + Number(row.estimated_cost_usd ?? 0));
    }
  }

  return {
    dailyCost,
    monthlyCost,
    organizationCost: monthlyCost,
    topPrompts: [...promptMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([promptId, cost]) => ({ promptId, cost })),
    moduleBreakdown: [...moduleMap.entries()].map(([module, v]) => ({ module, ...v })),
  };
}

export async function getUsageHistory(supabase: AuthClient, organizationId: string, limit = 50) {
  const { data } = await supabase
    .from("aip_token_usage")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
