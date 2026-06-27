import type { IdentityContext } from "@/lib/platform/identity/context";

export function canViewIntelligenceNetwork(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("network.view") ||
    ctx.permissions.includes("network.manage") ||
    ctx.permissions.includes("network.admin") ||
    ctx.permissions.includes("executive.intelligence") ||
    ctx.isEnterpriseAdmin
  );
}

export function canManageIntelligenceNetwork(ctx: IdentityContext) {
  return ctx.permissions.includes("network.manage") || ctx.permissions.includes("network.admin") || ctx.isEnterpriseAdmin;
}

export function canAdminIntelligenceNetwork(ctx: IdentityContext) {
  return ctx.permissions.includes("network.admin") || ctx.isEnterpriseAdmin;
}
