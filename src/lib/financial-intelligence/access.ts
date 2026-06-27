import type { IdentityContext } from "@/lib/platform/identity/context";

export function canViewFi(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("fi.view") ||
    ctx.permissions.includes("fi.executive") ||
    ctx.permissions.includes("fi.manage") ||
    ctx.permissions.includes("finance.executive") ||
    ctx.permissions.includes("finance.view") ||
    ctx.permissions.includes("executive.intelligence") ||
    ctx.isEnterpriseAdmin
  );
}

export function canManageFi(ctx: IdentityContext) {
  return ctx.permissions.includes("fi.manage") || ctx.isEnterpriseAdmin;
}

export function canRunScenarios(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("fi.scenarios") ||
    ctx.permissions.includes("fi.executive") ||
    ctx.permissions.includes("fi.manage") ||
    ctx.isEnterpriseAdmin
  );
}

export function canImportFi(ctx: IdentityContext) {
  return ctx.permissions.includes("fi.import") || ctx.permissions.includes("fi.manage") || ctx.isEnterpriseAdmin;
}
