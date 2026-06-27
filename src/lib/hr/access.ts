import type { IdentityContext } from "@/lib/platform/identity/context";

export function canAccessHrAdmin(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("hr.view") ||
    ctx.permissions.includes("hr.manage") ||
    ctx.isEnterpriseAdmin
  );
}

export function canManageHr(ctx: IdentityContext): boolean {
  return ctx.permissions.includes("hr.manage") || ctx.isEnterpriseAdmin;
}

export function canRunPayroll(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("payroll.run") ||
    ctx.permissions.includes("finance.payroll") ||
    ctx.isEnterpriseAdmin
  );
}

export function canAccessEmployeePortal(ctx: IdentityContext): boolean {
  return ctx.permissions.includes("employee.self_service") || canAccessHrAdmin(ctx);
}
