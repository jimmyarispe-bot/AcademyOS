import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getDeploymentRollouts(supabase: AuthClient) {
  const { data } = await supabase.from("ops_deployment_rollouts").select("*").order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}

export async function getCloudDeployments(supabase: AuthClient) {
  const { data } = await supabase.from("cloud_deployments").select("*").order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}

export async function createDeploymentRollout(
  supabase: AuthClient,
  input: { releaseVersion: string; strategy?: string }
) {
  const { data, error } = await supabase
    .from("ops_deployment_rollouts")
    .insert({
      release_version: input.releaseVersion,
      deployment_strategy: input.strategy ?? "rolling",
      status: "deploying",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("ops_deployment_rollouts").update({
    status: "active",
    completed_at: new Date().toISOString(),
  }).eq("id", data.id);

  return { rolloutId: data.id };
}
