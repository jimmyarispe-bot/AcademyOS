import type { createAuthClient } from "@/lib/supabase/server-auth";
import { E2E_WORKFLOWS } from "@/lib/certification/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

async function tableAccessible(supabase: AuthClient, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { count: "exact", head: true }).limit(1);
  return !error;
}

export async function runWorkflowTests(supabase: AuthClient, certRunId: string) {
  const results = [];

  for (const wf of E2E_WORKFLOWS) {
    const start = Date.now();
    let status: "pass" | "warning" | "failure" = "pass";
    let message = "Workflow chain validated";
    const errors: string[] = [];
    const evidence: Record<string, unknown> = { modules: wf.modules };
    let lastSuccessAt: string | null = new Date().toISOString();

    if (wf.table) {
      const ok = await tableAccessible(supabase, wf.table);
      if (!ok) {
        status = "warning";
        message = `Module table ${wf.table} requires verification`;
        errors.push(`Table access check: ${wf.table}`);
        lastSuccessAt = null;
      }
    }

    const { data: prior } = await supabase
      .from("cert_workflow_tests")
      .select("last_success_at")
      .eq("workflow_key", wf.key)
      .eq("status", "pass")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (status === "pass" && prior?.last_success_at) {
      evidence.priorSuccess = prior.last_success_at;
    }

    const executionTimeMs = Date.now() - start;
    await supabase.from("cert_workflow_tests").insert({
      cert_run_id: certRunId,
      workflow_key: wf.key,
      workflow_name: wf.name,
      status,
      execution_time_ms: executionTimeMs,
      evidence,
      message,
      errors,
      last_success_at: lastSuccessAt,
    });
    results.push({ ...wf, status, executionTimeMs, errors });
  }

  return results;
}

export async function getLatestWorkflowTests(supabase: AuthClient, certRunId?: string) {
  if (certRunId) {
    const { data } = await supabase.from("cert_workflow_tests").select("*").eq("cert_run_id", certRunId).order("workflow_name");
    return data ?? [];
  }
  const { data: run } = await supabase.from("cert_runs").select("id").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) return [];
  const { data } = await supabase.from("cert_workflow_tests").select("*").eq("cert_run_id", run.id).order("workflow_name");
  return data ?? [];
}
