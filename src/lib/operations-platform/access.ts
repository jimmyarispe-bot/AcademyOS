import type { IdentityContext } from "@/lib/platform/identity/context";

const OPS_PERMS = [
  "operations.view", "operations.manage", "operations.executive", "operations.security",
  "operations.support", "operations.billing", "operations.analytics", "operations.partners",
] as const;

export function canAccessOperationsCenter(ctx: IdentityContext) {
  if (ctx.isEnterpriseAdmin) return true;
  return OPS_PERMS.some((p) => ctx.permissions.includes(p))
    || ctx.permissions.includes("cloud.admin")
    || ctx.permissions.includes("cloud.operations");
}

export function canManageOperations(ctx: IdentityContext) {
  return ctx.permissions.includes("operations.manage") || ctx.isEnterpriseAdmin || ctx.permissions.includes("cloud.admin");
}

export function canOperationsExecutive(ctx: IdentityContext) {
  return ctx.permissions.includes("operations.executive") || canManageOperations(ctx);
}

export function canOperationsSecurity(ctx: IdentityContext) {
  return ctx.permissions.includes("operations.security") || canManageOperations(ctx);
}

export function canOperationsSupport(ctx: IdentityContext) {
  return ctx.permissions.includes("operations.support") || canManageOperations(ctx) || ctx.permissions.includes("cloud.support");
}

export function canOperationsBilling(ctx: IdentityContext) {
  return ctx.permissions.includes("operations.billing") || canManageOperations(ctx) || ctx.permissions.includes("cloud.finance");
}

export function canOperationsAnalytics(ctx: IdentityContext) {
  return ctx.permissions.includes("operations.analytics") || canManageOperations(ctx) || ctx.permissions.includes("cloud.analytics");
}

export function canOperationsPartners(ctx: IdentityContext) {
  return ctx.permissions.includes("operations.partners") || canManageOperations(ctx);
}
