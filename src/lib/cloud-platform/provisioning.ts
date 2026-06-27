import type { createAuthClient } from "@/lib/supabase/server-auth";
import { logCloudAudit } from "@/lib/cloud-platform/customers";
import { PROVISIONING_BLUEPRINTS } from "@/lib/cloud-platform/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function provisionOrganization(
  supabase: AuthClient,
  input: {
    targetOrgName: string;
    blueprintKey: string;
    customerId?: string;
    createdBy?: string;
  }
) {
  const blueprint = PROVISIONING_BLUEPRINTS.find((b) => b.key === input.blueprintKey) ?? PROVISIONING_BLUEPRINTS[0];

  const { data: job, error } = await supabase
    .from("cloud_provisioning_jobs")
    .insert({
      customer_id: input.customerId ?? null,
      blueprint_key: blueprint.key,
      target_org_name: input.targetOrgName,
      status: "running",
      started_at: new Date().toISOString(),
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const slug = input.targetOrgName.toLowerCase().replace(/\s+/g, "-").slice(0, 50);
  const { data: org, error: orgError } = await supabase
    .from("org_organizations")
    .insert({ name: input.targetOrgName, slug: `${slug}-${Date.now()}` })
    .select("id")
    .single();

  if (orgError) {
    await supabase.from("cloud_provisioning_jobs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", job.id);
    return { error: orgError.message };
  }

  const configSections = ["organization", "branding", "academic", "admissions", "finance", "hr", "workflows"];
  for (const section of configSections) {
    await supabase.from("config_sections").upsert({
      organization_id: org.id,
      school_id: null,
      section_key: section,
      config_data: { blueprint: blueprint.key, provisioned: true },
    }, { onConflict: "organization_id,school_id,section_key" });
  }

  if (input.customerId) {
    await supabase.from("cloud_customers").update({
      organization_id: org.id,
      status: "active",
      modules_enabled: blueprint.modules,
      is_white_label: "whiteLabel" in blueprint && blueprint.whiteLabel === true,
    }).eq("id", input.customerId);
  }

  await supabase.from("cloud_provisioning_jobs").update({
    status: "completed",
    progress_pct: 100,
    provisioned_organization_id: org.id,
    completed_at: new Date().toISOString(),
    result_summary: {
      organizationId: org.id,
      modules: blueprint.modules,
      configSections: configSections.length,
    },
  }).eq("id", job.id);

  await logCloudAudit(supabase, {
    actorUserId: input.createdBy,
    actionType: "organization_provisioned",
    entityType: "cloud_provisioning_jobs",
    entityId: job.id,
    customerId: input.customerId,
    details: { organizationId: org.id, blueprint: blueprint.key },
  });

  return { jobId: job.id, organizationId: org.id };
}

export async function getProvisioningJobs(supabase: AuthClient, limit = 20) {
  const { data } = await supabase
    .from("cloud_provisioning_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getOrganizations(supabase: AuthClient) {
  const { data } = await supabase
    .from("cloud_customers")
    .select("id, customer_name, organization_id, status, org_organizations(name, slug)")
    .not("organization_id", "is", null)
    .order("customer_name");
  return data ?? [];
}
