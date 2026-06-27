import type { IdentityContext } from "@/lib/platform/identity/context";

export function canViewConfiguration(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("configuration.view") ||
    ctx.permissions.includes("configuration.manage") ||
    ctx.permissions.includes("configuration.admin") ||
    ctx.permissions.includes("org.view") ||
    ctx.permissions.includes("school.configure") ||
    ctx.isEnterpriseAdmin
  );
}

export function canManageConfiguration(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("configuration.manage") ||
    ctx.permissions.includes("configuration.admin") ||
    ctx.permissions.includes("school.configure") ||
    ctx.isEnterpriseAdmin
  );
}

export function canAdminConfiguration(ctx: IdentityContext) {
  return ctx.permissions.includes("configuration.admin") || ctx.isEnterpriseAdmin;
}

export function canLaunchOrganization(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("configuration.launch") ||
    ctx.permissions.includes("configuration.admin") ||
    ctx.isEnterpriseAdmin
  );
}
