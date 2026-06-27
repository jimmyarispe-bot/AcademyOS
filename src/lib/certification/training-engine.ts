import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getUniversityPaths(supabase: AuthClient) {
  const { data } = await supabase.from("cert_university_paths").select("*").order("sort_order");
  return data ?? [];
}

export async function getUserProgress(supabase: AuthClient, userId: string) {
  const { data } = await supabase.from("cert_university_progress").select("*").eq("user_id", userId);
  return data ?? [];
}

export async function updateProgress(supabase: AuthClient, userId: string, pathKey: string, moduleKey: string) {
  const { data: existing } = await supabase
    .from("cert_university_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("path_key", pathKey)
    .maybeSingle();

  const completed = [...((existing?.completed_modules as string[]) ?? [])];
  if (!completed.includes(moduleKey)) completed.push(moduleKey);

  const { data: path } = await supabase.from("cert_university_paths").select("modules").eq("path_key", pathKey).single();
  const totalModules = ((path?.modules as string[]) ?? []).length || 3;
  const progressPct = Math.min(100, Math.round((completed.length / totalModules) * 100));

  await supabase.from("cert_university_progress").upsert({
    user_id: userId,
    path_key: pathKey,
    completed_modules: completed,
    progress_pct: progressPct,
    certificate_issued_at: progressPct >= 100 ? new Date().toISOString() : null,
  }, { onConflict: "user_id,path_key" });

  return { progressPct };
}

export async function getTrainingCompletionScore(supabase: AuthClient) {
  const [{ count: paths }, { count: progress }] = await Promise.all([
    supabase.from("cert_university_paths").select("id", { count: "exact", head: true }),
    supabase.from("cert_university_progress").select("id", { count: "exact", head: true }).gte("progress_pct", 100),
  ]);
  const pathCount = paths ?? 15;
  const completed = progress ?? 0;
  const score = Math.min(100, 75 + (completed / Math.max(pathCount, 1)) * 25);
  return { score };
}
