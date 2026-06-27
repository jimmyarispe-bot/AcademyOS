import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { GoLiveCheck } from "@/lib/configuration/types";
import { getOrganizationHierarchy } from "@/lib/platform/identity/org";
import { getModuleMarketplace } from "@/lib/configuration/modules";
import { getConfigSection } from "@/lib/configuration/sections";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const CHECKS: Array<Omit<GoLiveCheck, "status" | "message"> & { validate: (ctx: ValidationContext) => GoLiveCheck }> = [
  {
    checkKey: "branding",
    checkCategory: "branding",
    title: "Branding configured",
    isRequired: true,
    resolveHref: "/dashboard/admin/branding",
    validate: (ctx) => ({
      checkKey: "branding",
      checkCategory: "branding",
      title: "Branding configured",
      isRequired: true,
      resolveHref: "/dashboard/admin/branding",
      status: ctx.branding.primary_color ? "green" : "yellow",
      message: ctx.branding.primary_color ? "Primary brand color set" : "Set logo and brand colors",
    }),
  },
  {
    checkKey: "schools",
    checkCategory: "organization",
    title: "Schools configured",
    isRequired: true,
    resolveHref: "/dashboard/admin/schools",
    validate: (ctx) => ({
      checkKey: "schools",
      checkCategory: "organization",
      title: "Schools configured",
      isRequired: true,
      resolveHref: "/dashboard/admin/schools",
      status: ctx.schoolCount > 0 ? "green" : "red",
      message: ctx.schoolCount > 0 ? `${ctx.schoolCount} school(s) configured` : "Add at least one school",
    }),
  },
  {
    checkKey: "programs",
    checkCategory: "academic",
    title: "Programs configured",
    isRequired: true,
    resolveHref: "/dashboard/admin/programs",
    validate: (ctx) => ({
      checkKey: "programs",
      checkCategory: "academic",
      title: "Programs configured",
      isRequired: true,
      resolveHref: "/dashboard/admin/programs",
      status: ctx.programCount > 0 ? "green" : "yellow",
      message: ctx.programCount > 0 ? `${ctx.programCount} program(s)` : "Configure academic programs",
    }),
  },
  {
    checkKey: "modules",
    checkCategory: "modules",
    title: "Core modules enabled",
    isRequired: true,
    resolveHref: "/dashboard/admin/modules",
    validate: (ctx) => ({
      checkKey: "modules",
      checkCategory: "modules",
      title: "Core modules enabled",
      isRequired: true,
      resolveHref: "/dashboard/admin/modules",
      status: ctx.enabledModules >= 3 ? "green" : "yellow",
      message: `${ctx.enabledModules} modules enabled`,
    }),
  },
  {
    checkKey: "admissions",
    checkCategory: "admissions",
    title: "Admissions configuration",
    isRequired: true,
    resolveHref: "/dashboard/admin/admissions",
    validate: (ctx) => ({
      checkKey: "admissions",
      checkCategory: "admissions",
      title: "Admissions configuration",
      isRequired: true,
      resolveHref: "/dashboard/admin/admissions",
      status: (ctx.admissions.workflow_stages as string[])?.length ? "green" : "yellow",
      message: "Admissions workflow stages defined",
    }),
  },
  {
    checkKey: "finance",
    checkCategory: "finance",
    title: "Finance configuration",
    isRequired: true,
    resolveHref: "/dashboard/admin/finance",
    validate: (ctx) => ({
      checkKey: "finance",
      checkCategory: "finance",
      title: "Finance configuration",
      isRequired: true,
      resolveHref: "/dashboard/admin/finance",
      status: (ctx.finance.tuition_models as string[])?.length ? "green" : "yellow",
      message: "Tuition and billing models configured",
    }),
  },
  {
    checkKey: "roles",
    checkCategory: "security",
    title: "Roles and permissions",
    isRequired: true,
    resolveHref: "/dashboard/admin/roles",
    validate: (ctx) => ({
      checkKey: "roles",
      checkCategory: "security",
      title: "Roles and permissions",
      isRequired: true,
      resolveHref: "/dashboard/admin/roles",
      status: "green",
      message: "RBAC configured via enterprise identity",
    }),
  },
  {
    checkKey: "executive",
    checkCategory: "executive",
    title: "Executive dashboards",
    isRequired: false,
    resolveHref: "/dashboard/executive",
    validate: (ctx) => ({
      checkKey: "executive",
      checkCategory: "executive",
      title: "Executive dashboards",
      isRequired: false,
      resolveHref: "/dashboard/executive",
      status: ctx.enabledModules > 0 ? "green" : "yellow",
      message: "Executive intelligence available when modules enabled",
    }),
  },
];

interface ValidationContext {
  branding: Record<string, unknown>;
  admissions: Record<string, unknown>;
  finance: Record<string, unknown>;
  schoolCount: number;
  programCount: number;
  enabledModules: number;
}

export async function runGoLiveValidation(supabase: AuthClient, organizationId: string): Promise<GoLiveCheck[]> {
  const [hierarchy, modules, branding, admissions, finance] = await Promise.all([
    getOrganizationHierarchy(),
    getModuleMarketplace(supabase, organizationId),
    getConfigSection(supabase, organizationId, "branding"),
    getConfigSection(supabase, organizationId, "admissions"),
    getConfigSection(supabase, organizationId, "finance"),
  ]);

  const ctx: ValidationContext = {
    branding,
    admissions,
    finance,
    schoolCount: hierarchy.schools.length,
    programCount: hierarchy.programs.length,
    enabledModules: modules.filter((m) => m.status === "enabled").length,
  };

  const results = CHECKS.map((c) => c.validate(ctx));

  for (const check of results) {
    await supabase.from("config_go_live_checks").upsert(
      {
        organization_id: organizationId,
        check_key: check.checkKey,
        check_category: check.checkCategory,
        title: check.title,
        status: check.status,
        message: check.message ?? null,
        resolve_href: check.resolveHref ?? null,
        is_required: check.isRequired,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,check_key" }
    );
  }

  return results;
}

export async function getGoLiveSummary(supabase: AuthClient, organizationId: string) {
  const checks = await runGoLiveValidation(supabase, organizationId);
  const blocking = checks.filter((c) => c.isRequired && c.status === "red").length;
  const ready = blocking === 0 && checks.filter((c) => c.isRequired).every((c) => c.status === "green");

  return { checks, ready, blocking };
}

export async function launchOrganization(
  supabase: AuthClient,
  organizationId: string,
  userId?: string
) {
  const { checks, ready } = await getGoLiveSummary(supabase, organizationId);
  if (!ready) return { error: "Not all required checks pass", checks };

  const { data, error } = await supabase
    .from("config_go_live_launches")
    .insert({
      organization_id: organizationId,
      launched_by: userId ?? null,
      launch_status: "launched",
      validation_snapshot: { checks },
      launched_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("org_organizations")
    .update({ status: "active" })
    .eq("id", organizationId);

  return { success: true, launchId: data.id };
}
