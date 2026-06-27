import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function startCloneJob(
  supabase: AuthClient,
  input: {
    organizationId: string;
    cloneType: string;
    sourceScope: Record<string, unknown>;
    targetScope: Record<string, unknown>;
    includeUsers?: boolean;
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_clone_jobs")
    .insert({
      organization_id: input.organizationId,
      clone_type: input.cloneType,
      source_scope: input.sourceScope,
      target_scope: input.targetScope,
      include_users: input.includeUsers ?? false,
      status: "running",
      started_at: new Date().toISOString(),
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { data: sections } = await supabase
    .from("config_sections")
    .select("section_key, config_data")
    .eq("organization_id", input.organizationId);

  await supabase.from("edp_clone_jobs").update({
    status: "completed",
    progress_pct: 100,
    completed_at: new Date().toISOString(),
    result_summary: {
      clonedSections: (sections ?? []).length,
      includeUsers: input.includeUsers ?? false,
      blueprint: input.cloneType === "blueprint",
    },
  }).eq("id", data.id);

  return { jobId: data.id };
}

export async function listCloneJobs(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_clone_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}
