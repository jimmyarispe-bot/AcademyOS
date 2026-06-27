import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ConfigModuleRow, ModuleInstallStatus } from "@/lib/configuration/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getModuleMarketplace(
  supabase: AuthClient,
  organizationId: string
): Promise<ConfigModuleRow[]> {
  const [{ data: defs }, { data: installs }] = await Promise.all([
    supabase.from("config_module_definitions").select("*").order("sort_order"),
    supabase.from("config_module_installations").select("*").eq("organization_id", organizationId),
  ]);

  const installMap = new Map((installs ?? []).map((i) => [i.module_key, i]));

  return (defs ?? []).map((d) => {
    const inst = installMap.get(d.module_key);
    return {
      moduleKey: d.module_key,
      displayName: d.display_name,
      description: d.description ?? undefined,
      category: d.category,
      dependencies: (d.dependencies as string[]) ?? [],
      status: (inst?.status as ModuleInstallStatus) ?? "disabled",
      installedVersion: inst?.installed_version,
    };
  });
}

export async function setModuleStatus(
  supabase: AuthClient,
  input: {
    organizationId: string;
    moduleKey: string;
    status: ModuleInstallStatus;
    userId?: string;
  }
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    organization_id: input.organizationId,
    module_key: input.moduleKey,
    status: input.status,
    installed_by: input.userId ?? null,
  };

  if (input.status === "installed" || input.status === "enabled") {
    patch.installed_at = now;
    patch.installed_version = "11.0";
  }
  if (input.status === "enabled") patch.enabled_at = now;
  if (input.status === "disabled") patch.disabled_at = now;

  const { error } = await supabase
    .from("config_module_installations")
    .upsert(patch, { onConflict: "organization_id,module_key" });

  if (error) return { error: error.message };
  return { success: true };
}

export async function installModule(
  supabase: AuthClient,
  organizationId: string,
  moduleKey: string,
  userId?: string
) {
  const marketplace = await getModuleMarketplace(supabase, organizationId);
  const mod = marketplace.find((m) => m.moduleKey === moduleKey);
  if (!mod) return { error: "Module not found" };

  for (const dep of mod.dependencies) {
    const depMod = marketplace.find((m) => m.moduleKey === dep);
    if (depMod && depMod.status !== "enabled" && depMod.status !== "installed") {
      await installModule(supabase, organizationId, dep, userId);
    }
  }

  return setModuleStatus(supabase, {
    organizationId,
    moduleKey,
    status: "enabled",
    userId,
  });
}

export async function disableModule(
  supabase: AuthClient,
  organizationId: string,
  moduleKey: string,
  userId?: string
) {
  return setModuleStatus(supabase, { organizationId, moduleKey, status: "disabled", userId });
}
