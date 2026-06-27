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
    let status: "pass" | "warning" | "failure" = "warning";
    let message = "Table accessibility probe only — not a behavioral E2E test";
    const errors: string[] = [];
    const evidence: Record<string, unknown> = {
      modules: wf.modules,
      probeType: "table_select_head",
      behavioralE2e: false,
    };
    let lastSuccessAt: string | null = null;

    if (wf.table) {
      const ok = await tableAccessible(supabase, wf.table);
      if (ok) {
        status = "warning";
        message = `Table ${wf.table} reachable — behavioral workflow not verified`;
        lastSuccessAt = new Date().toISOString();
      } else {
        status = "failure";
        message = `Table ${wf.table} inaccessible or missing RLS grant`;
        errors.push(`Table access check failed: ${wf.table}`);
      }
    } else {
      status = "warning";
      errors.push("No table defined for workflow probe");
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

export function computeWorkflowTestScore(
  results: Array<{ status: string }>
): number {
  if (!results.length) return 0;
  let score = 0;
  for (const r of results) {
    if (r.status === "pass") score += 100;
    else if (r.status === "warning") score += 55;
    else score += 0;
  }
  return Math.round(score / results.length);
}
