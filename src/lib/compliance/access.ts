import type { IdentityContext } from "@/lib/platform/identity/context";

export function canViewCompliance(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("compliance.view") ||
    ctx.permissions.includes("compliance.manage") ||
    ctx.permissions.includes("compliance.admin") ||
    ctx.permissions.includes("executive.intelligence") ||
    ctx.isEnterpriseAdmin
  );
}

export function canManageCompliance(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("compliance.manage") ||
    ctx.permissions.includes("compliance.admin") ||
    ctx.isEnterpriseAdmin
  );
}

export function canAdminCompliance(ctx: IdentityContext): boolean {
  return ctx.permissions.includes("compliance.admin") || ctx.isEnterpriseAdmin;
}

export function canExportComplianceReports(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("compliance.reports") ||
    ctx.permissions.includes("compliance.admin") ||
    ctx.permissions.includes("global.reporting") ||
    ctx.isEnterpriseAdmin
  );
}
