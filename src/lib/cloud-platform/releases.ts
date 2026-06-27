import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getReleases(supabase: AuthClient) {
  const { data } = await supabase.from("cloud_releases").select("*").order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}

export async function createRelease(
  supabase: AuthClient,
  input: { releaseVersion: string; releaseType?: string; releaseNotes?: string }
) {
  const { data, error } = await supabase
    .from("cloud_releases")
    .insert({
      release_version: input.releaseVersion,
      release_type: input.releaseType ?? "minor",
      release_notes: input.releaseNotes ?? null,
      status: "planned",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { releaseId: data.id };
}

export async function getFeatureFlags(supabase: AuthClient) {
  const { data } = await supabase.from("cloud_feature_flags").select("*").order("flag_key");
  return data ?? [];
}

export async function upsertFeatureFlag(
  supabase: AuthClient,
  input: {
    flagKey: string;
    displayName: string;
    scopeType?: string;
    isEnabled?: boolean;
    isBeta?: boolean;
    isInternalOnly?: boolean;
  }
) {
  await supabase.from("cloud_feature_flags").upsert({
    flag_key: input.flagKey,
    display_name: input.displayName,
    scope_type: input.scopeType ?? "global",
    is_enabled: input.isEnabled ?? false,
    is_beta: input.isBeta ?? false,
    is_internal_only: input.isInternalOnly ?? false,
  }, { onConflict: "flag_key" });
}

export async function getDeployments(supabase: AuthClient) {
  const { data } = await supabase
    .from("cloud_deployments")
    .select("*, cloud_releases(release_version)")
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function createDeployment(
  supabase: AuthClient,
  input: { environment: string; releaseId?: string; deployedBy?: string }
) {
  const { data, error } = await supabase
    .from("cloud_deployments")
    .insert({
      environment: input.environment,
      release_id: input.releaseId ?? null,
      status: "pending",
      deployed_by: input.deployedBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { deploymentId: data.id };
}
