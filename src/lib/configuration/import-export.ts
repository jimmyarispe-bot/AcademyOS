import type { createAuthClient } from "@/lib/supabase/server-auth";
import { listConfigSections } from "@/lib/configuration/sections";
import { getModuleMarketplace } from "@/lib/configuration/modules";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function exportConfigurationPackage(
  supabase: AuthClient,
  organizationId: string,
  packageType: "full" | "school" | "program" | "playbooks" | "templates" | "workflows" = "full",
  exportedBy?: string
) {
  const [{ data: sections }, modules] = await Promise.all([
    supabase.from("config_sections").select("*").eq("organization_id", organizationId),
    getModuleMarketplace(supabase, organizationId),
  ]);

  const packageData = {
    version: "11.0",
    exported_at: new Date().toISOString(),
    sections: sections ?? [],
    modules,
  };

  const { data, error } = await supabase
    .from("config_packages")
    .insert({
      organization_id: organizationId,
      package_name: `export-${packageType}-${Date.now()}`,
      package_type: packageType,
      package_data: packageData,
      format: "json",
      exported_by: exportedBy ?? null,
    })
    .select("id, package_data")
    .single();

  if (error) return { error: error.message };
  return { packageId: data.id, data: packageData };
}

export async function importConfigurationPackage(
  supabase: AuthClient,
  organizationId: string,
  packageData: {
    sections?: Array<{ section_key: string; config_data: Record<string, unknown>; school_id?: string | null }>;
    modules?: Array<{ moduleKey: string; status: string }>;
  },
  importedBy?: string
) {
  for (const section of packageData.sections ?? []) {
    await supabase.from("config_sections").upsert(
      {
        organization_id: organizationId,
        school_id: section.school_id ?? null,
        section_key: section.section_key,
        config_data: section.config_data,
        updated_by: importedBy ?? null,
      },
      { onConflict: "organization_id,school_id,section_key" }
    );
  }

  for (const mod of packageData.modules ?? []) {
    if (mod.status === "enabled") {
      await supabase.from("config_module_installations").upsert(
        {
          organization_id: organizationId,
          module_key: mod.moduleKey,
          status: "enabled",
          installed_version: "11.0",
          enabled_at: new Date().toISOString(),
          installed_by: importedBy ?? null,
        },
        { onConflict: "organization_id,module_key" }
      );
    }
  }

  await supabase.from("config_packages").insert({
    organization_id: organizationId,
    package_name: `import-${Date.now()}`,
    package_type: "full",
    package_data: packageData,
    format: "json",
    imported_by: importedBy ?? null,
  });

  return { success: true };
}

export function configurationToJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function parseConfigurationJson(content: string) {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getConfigurationSummary(supabase: AuthClient, organizationId: string) {
  const sections = await listConfigSections(supabase, organizationId);
  return { sectionCount: sections.length, sections };
}
