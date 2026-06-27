import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function runPromptTest(
  supabase: AuthClient,
  input: {
    organizationId: string;
    promptId?: string;
    promptVersionId?: string;
    providerKey?: string;
    testInput?: Record<string, unknown>;
    runBy?: string;
  }
) {
  const start = Date.now();
  const simulatedOutput = {
    note: "Simulated response — no AI provider invoked (Release 12.5 architecture)",
    input: input.testInput ?? {},
    provider: input.providerKey ?? "none",
  };

  const { data, error } = await supabase
    .from("aip_test_runs")
    .insert({
      organization_id: input.organizationId,
      prompt_id: input.promptId ?? null,
      prompt_version_id: input.promptVersionId ?? null,
      provider_key: input.providerKey ?? null,
      test_input: input.testInput ?? {},
      simulated_output: simulatedOutput,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - start,
      status: "simulated",
      run_by: input.runBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("aip_audit_logs").insert({
    organization_id: input.organizationId,
    requested_by: input.runBy ?? null,
    prompt_id: input.promptId ?? null,
    prompt_version_id: input.promptVersionId ?? null,
    provider_key: input.providerKey ?? null,
    response_status: "simulated",
    execution_time_ms: Date.now() - start,
    metadata: { testRunId: data.id, testingLab: true },
  });

  return { testRunId: data.id, output: simulatedOutput, latencyMs: Date.now() - start };
}

export async function getTestRuns(supabase: AuthClient, organizationId: string, limit = 20) {
  const { data } = await supabase
    .from("aip_test_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
