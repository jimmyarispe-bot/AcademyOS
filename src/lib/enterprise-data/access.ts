import type { IdentityContext } from "@/lib/platform/identity/context";

export function canViewDataPlatform(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("data.view") ||
    ctx.permissions.includes("data.manage") ||
    ctx.permissions.includes("data.import") ||
    ctx.permissions.includes("data.export") ||
    ctx.permissions.includes("data.admin") ||
    ctx.permissions.includes("fi.import") ||
    ctx.isEnterpriseAdmin
  );
}

export function canImportData(ctx: IdentityContext) {
  return ctx.permissions.includes("data.import") || ctx.permissions.includes("data.admin") || ctx.isEnterpriseAdmin;
}

export function canExportData(ctx: IdentityContext) {
  return ctx.permissions.includes("data.export") || ctx.permissions.includes("data.admin") || ctx.isEnterpriseAdmin;
}

export function canManageDataPlatform(ctx: IdentityContext) {
  return ctx.permissions.includes("data.manage") || ctx.permissions.includes("data.admin") || ctx.isEnterpriseAdmin;
}

export function canAdminDataPlatform(ctx: IdentityContext) {
  return ctx.permissions.includes("data.admin") || ctx.isEnterpriseAdmin;
}
