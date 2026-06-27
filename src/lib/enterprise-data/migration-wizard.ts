import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { MigrationStep } from "@/lib/enterprise-data/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function startMigrationSession(
  supabase: AuthClient,
  input: { organizationId: string; startedBy?: string }
) {
  const { data, error } = await supabase
    .from("edp_migration_sessions")
    .insert({
      organization_id: input.organizationId,
      current_step: "upload",
      status: "in_progress",
      started_by: input.startedBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { sessionId: data.id };
}

export async function advanceMigrationStep(
  supabase: AuthClient,
  sessionId: string,
  step: MigrationStep,
  sessionData?: Record<string, unknown>
) {
  const updates: Record<string, unknown> = { current_step: step };
  if (sessionData) updates.session_data = sessionData;
  if (step === "report") {
    updates.status = "completed";
    updates.completed_at = new Date().toISOString();
  }
  await supabase.from("edp_migration_sessions").update(updates).eq("id", sessionId);
}

export async function getMigrationSession(supabase: AuthClient, sessionId: string) {
  const { data } = await supabase.from("edp_migration_sessions").select("*").eq("id", sessionId).maybeSingle();
  return data;
}

export async function getActiveMigrationSessions(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_migration_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function rollbackMigration(supabase: AuthClient, sessionId: string, batchId?: string) {
  if (batchId) {
    const { rollbackImportBatch } = await import("@/lib/enterprise-data/import-engine");
    await rollbackImportBatch(supabase, batchId);
  }
  await supabase.from("edp_migration_sessions").update({ status: "rolled_back" }).eq("id", sessionId);
  return { success: true };
}
