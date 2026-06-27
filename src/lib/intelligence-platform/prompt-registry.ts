import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { AipPromptCategory, AipPromptStatus } from "@/lib/intelligence-platform/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getPrompts(supabase: AuthClient, organizationId: string, category?: string) {
  let query = supabase.from("aip_prompts").select("*").eq("organization_id", organizationId).order("name");
  if (category) query = query.eq("category", category);
  const { data } = await query;
  return data ?? [];
}

export async function createPrompt(
  supabase: AuthClient,
  input: {
    organizationId: string;
    promptKey: string;
    name: string;
    description?: string;
    category: AipPromptCategory;
    module: string;
    template: string;
    systemInstructions?: string;
    ownerId?: string;
    tags?: string[];
  }
) {
  const { data: prompt, error } = await supabase
    .from("aip_prompts")
    .insert({
      organization_id: input.organizationId,
      prompt_key: input.promptKey,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      module: input.module,
      status: "draft",
      owner_id: input.ownerId ?? null,
      current_version: 1,
      tags: input.tags ?? [],
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("aip_prompt_versions").insert({
    prompt_id: prompt.id,
    version_number: 1,
    prompt_template: input.template,
    system_instructions: input.systemInstructions ?? null,
    created_by: input.ownerId ?? null,
  });

  return { promptId: prompt.id };
}

export async function createPromptVersion(
  supabase: AuthClient,
  promptId: string,
  input: { template: string; systemInstructions?: string; changeSummary?: string; createdBy?: string }
) {
  const { data: prompt } = await supabase.from("aip_prompts").select("current_version").eq("id", promptId).single();
  if (!prompt) return { error: "Prompt not found" };

  const nextVersion = (prompt.current_version ?? 0) + 1;
  const { data, error } = await supabase
    .from("aip_prompt_versions")
    .insert({
      prompt_id: promptId,
      version_number: nextVersion,
      prompt_template: input.template,
      system_instructions: input.systemInstructions ?? null,
      change_summary: input.changeSummary ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("aip_prompts").update({ current_version: nextVersion, status: "draft" }).eq("id", promptId);
  return { versionId: data.id, versionNumber: nextVersion };
}

export async function getPromptVersions(supabase: AuthClient, promptId: string) {
  const { data } = await supabase
    .from("aip_prompt_versions")
    .select("*")
    .eq("prompt_id", promptId)
    .order("version_number", { ascending: false });
  return data ?? [];
}

export async function rollbackPrompt(supabase: AuthClient, promptId: string, versionNumber: number, userId?: string) {
  const { data: version } = await supabase
    .from("aip_prompt_versions")
    .select("*")
    .eq("prompt_id", promptId)
    .eq("version_number", versionNumber)
    .maybeSingle();

  if (!version) return { error: "Version not found" };

  await supabase.from("aip_prompts").update({
    current_version: versionNumber,
    rollback_version: versionNumber,
    status: "draft",
  }).eq("id", promptId);

  const { data: promptRow } = await supabase.from("aip_prompts").select("organization_id").eq("id", promptId).single();
  if (promptRow?.organization_id) {
    await supabase.from("aip_approvals").insert({
      organization_id: promptRow.organization_id,
      entity_type: "prompt",
      entity_id: promptId,
      approval_type: "human_review",
      status: "rolled_back",
      requested_by: userId ?? null,
      reviewed_at: new Date().toISOString(),
    });
  }

  return { success: true, versionNumber };
}

export async function updatePromptStatus(supabase: AuthClient, promptId: string, status: AipPromptStatus, approvedBy?: string) {
  const updates: Record<string, unknown> = { status };
  if (status === "approved" || status === "published") {
    updates.approved_by = approvedBy ?? null;
    updates.approved_at = new Date().toISOString();
  }
  await supabase.from("aip_prompts").update(updates).eq("id", promptId);
}
