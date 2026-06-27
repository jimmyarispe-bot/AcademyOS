import type { IdentityContext } from "@/lib/platform/identity/context";

const CLOUD_PERMS = [
  "cloud.admin", "cloud.support", "cloud.operations", "cloud.sales",
  "cloud.finance", "cloud.engineering", "cloud.analytics",
] as const;

export function canAccessCloudConsole(ctx: IdentityContext) {
  if (ctx.isEnterpriseAdmin) return true;
  return CLOUD_PERMS.some((p) => ctx.permissions.includes(p));
}

export function canAdminCloud(ctx: IdentityContext) {
  return ctx.permissions.includes("cloud.admin") || ctx.isEnterpriseAdmin;
}

export function canCloudSupport(ctx: IdentityContext) {
  return ctx.permissions.includes("cloud.support") || canAdminCloud(ctx);
}

export function canCloudSales(ctx: IdentityContext) {
  return ctx.permissions.includes("cloud.sales") || canAdminCloud(ctx);
}

export function canCloudFinance(ctx: IdentityContext) {
  return ctx.permissions.includes("cloud.finance") || canAdminCloud(ctx);
}

export function canCloudOperations(ctx: IdentityContext) {
  return ctx.permissions.includes("cloud.operations") || canAdminCloud(ctx);
}

export function canCloudEngineering(ctx: IdentityContext) {
  return ctx.permissions.includes("cloud.engineering") || canAdminCloud(ctx);
}

export function canCloudAnalytics(ctx: IdentityContext) {
  return ctx.permissions.includes("cloud.analytics") || canAdminCloud(ctx);
}
