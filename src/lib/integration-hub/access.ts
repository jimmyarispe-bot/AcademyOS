import type { IdentityContext } from "@/lib/platform/identity/context";

export function canViewIntegrationHub(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("integration.view") ||
    ctx.permissions.includes("integration.manage") ||
    ctx.permissions.includes("integration.admin") ||
    ctx.permissions.includes("integration.developer") ||
    ctx.permissions.includes("integration.marketplace") ||
    ctx.permissions.includes("integration.operations") ||
    ctx.permissions.includes("integration.security") ||
    ctx.permissions.includes("developer.portal") ||
    ctx.permissions.includes("data.view") ||
    ctx.isEnterpriseAdmin
  );
}

export function canManageIntegrationHub(ctx: IdentityContext): boolean {
  return ctx.permissions.includes("integration.manage") || ctx.permissions.includes("integration.admin") || ctx.isEnterpriseAdmin;
}

export function canAdminIntegrationHub(ctx: IdentityContext): boolean {
  return ctx.permissions.includes("integration.admin") || ctx.isEnterpriseAdmin;
}

export function canAccessDeveloperPortal(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("integration.developer") ||
    ctx.permissions.includes("developer.portal") ||
    ctx.permissions.includes("integration.admin") ||
    ctx.isEnterpriseAdmin
  );
}

export function canAccessMarketplace(ctx: IdentityContext): boolean {
  return ctx.permissions.includes("integration.marketplace") || ctx.permissions.includes("integration.admin") || ctx.isEnterpriseAdmin;
}

export function canAccessOperations(ctx: IdentityContext): boolean {
  return ctx.permissions.includes("integration.operations") || ctx.permissions.includes("integration.admin") || ctx.isEnterpriseAdmin;
}

export function canAccessIntegrationSecurity(ctx: IdentityContext): boolean {
  return ctx.permissions.includes("integration.security") || ctx.permissions.includes("integration.admin") || ctx.isEnterpriseAdmin;
}
