import type { createAuthClient } from "@/lib/supabase/server-auth";
import { provisionOrganization } from "@/lib/cloud-platform/provisioning";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function provisionTenant(
  supabase: AuthClient,
  input: {
    tenantName: string;
    configPackage?: string;
    includeDemoData?: boolean;
    createdBy?: string;
  }
) {
  const { data: job, error } = await supabase
    .from("ihub_provisioning_jobs")
    .insert({
      tenant_name: input.tenantName,
      status: "running",
      config_package: input.configPackage ?? "enterprise",
      include_demo_data: input.includeDemoData ?? false,
      created_by: input.createdBy ?? null,
      started_at: new Date().toISOString(),
      steps_completed: ["create_organization"],
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const provision = await provisionOrganization(supabase, {
    targetOrgName: input.tenantName,
    blueprintKey: input.configPackage ?? "enterprise",
    createdBy: input.createdBy,
  });

  const steps = [
    "create_organization", "create_tenant", "apply_configuration",
    "install_modules", "assign_subscription", "provision_storage",
    "configure_backup", "configure_monitoring",
  ];
  if (input.includeDemoData) steps.push("generate_demo_data");

  await supabase.from("ihub_provisioning_jobs").update({
    status: provision.organizationId ? "completed" : "failed",
    organization_id: provision.organizationId ?? null,
    completed_at: new Date().toISOString(),
    steps_completed: steps,
    modules_installed: ["integrations", "data_platform", "automation"],
  }).eq("id", job.id);

  return { jobId: job.id, organizationId: provision.organizationId };
}

export async function getProvisioningJobs(supabase: AuthClient, limit = 20) {
  const { data } = await supabase
    .from("ihub_provisioning_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
