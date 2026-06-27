import type { IdentityContext } from "@/lib/platform/identity/context";
import type { createAuthClient } from "@/lib/supabase/server-auth";
import { userHasPermission } from "@/lib/platform/identity/permissions";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export function canViewCertification(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("certification.view") ||
    ctx.permissions.includes("certification.manage") ||
    ctx.permissions.includes("certification.admin") ||
    ctx.isEnterpriseAdmin
  );
}

export async function requireCertificationAccess(
  supabase: AuthClient,
  ctx: IdentityContext
): Promise<boolean> {
  if (ctx.isEnterpriseAdmin || ctx.isFounder) return true;

  return (
    (await userHasPermission(supabase, "certification.view", ctx.effectiveUserId)) ||
    (await userHasPermission(supabase, "certification.manage", ctx.effectiveUserId)) ||
    (await userHasPermission(supabase, "certification.admin", ctx.effectiveUserId))
  );
}

export function canManageCertification(ctx: IdentityContext) {
  return ctx.permissions.includes("certification.manage") || ctx.permissions.includes("certification.admin") || ctx.isEnterpriseAdmin;
}

export function canAdminCertification(ctx: IdentityContext) {
  return ctx.permissions.includes("certification.admin") || ctx.isEnterpriseAdmin;
}
