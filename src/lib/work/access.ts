import type { IdentityContext } from "@/lib/platform/identity/context";

export function canViewWork(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("work.view") ||
    ctx.permissions.includes("work.manage") ||
    ctx.permissions.includes("work.admin") ||
    ctx.permissions.includes("work.executive") ||
    ctx.isEnterpriseAdmin
  );
}

export function canManageWork(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("work.manage") ||
    ctx.permissions.includes("work.admin") ||
    ctx.isEnterpriseAdmin
  );
}

export function canAdminWork(ctx: IdentityContext) {
  return ctx.permissions.includes("work.admin") || ctx.isEnterpriseAdmin;
}

export function canViewWorkReports(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("work.reports") ||
    ctx.permissions.includes("work.executive") ||
    ctx.permissions.includes("work.admin") ||
    ctx.isEnterpriseAdmin
  );
}
