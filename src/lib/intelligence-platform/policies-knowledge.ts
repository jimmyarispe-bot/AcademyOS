import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getPolicies(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("aip_policies")
    .select("*")
    .eq("organization_id", organizationId)
    .order("policy_name");
  return data ?? [];
}

export async function createPolicy(
  supabase: AuthClient,
  input: {
    organizationId: string;
    policyKey: string;
    policyName: string;
    policyType?: string;
    description?: string;
    rules?: Record<string, unknown>;
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("aip_policies")
    .insert({
      organization_id: input.organizationId,
      policy_key: input.policyKey,
      policy_name: input.policyName,
      policy_type: input.policyType ?? "usage",
      description: input.description ?? null,
      rules: input.rules ?? {},
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { policyId: data.id };
}

export async function getKnowledgeSources(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("aip_knowledge_sources")
    .select("*")
    .eq("organization_id", organizationId)
    .order("source_name");
  return data ?? [];
}

export async function registerKnowledgeSource(
  supabase: AuthClient,
  input: {
    organizationId: string;
    sourceKey: string;
    sourceName: string;
    sourceType: string;
    schoolId?: string;
    classification?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("aip_knowledge_sources")
    .insert({
      organization_id: input.organizationId,
      school_id: input.schoolId ?? null,
      source_key: input.sourceKey,
      source_name: input.sourceName,
      source_type: input.sourceType,
      classification: input.classification ?? "internal",
      metadata: input.metadata ?? {},
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { sourceId: data.id };
}
