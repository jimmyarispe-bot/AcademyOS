import type { IdentityContext } from "@/lib/platform/identity/context";

export function canAccessExecutiveIntelligence(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("executive.intelligence") ||
    ctx.permissions.includes("executive.dashboard") ||
    ctx.permissions.includes("global.reporting") ||
    ctx.isEnterpriseAdmin
  );
}

export function canAccessBoardReports(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("executive.board_reports") ||
    ctx.permissions.includes("global.reporting") ||
    ctx.permissions.includes("finance.export") ||
    ctx.isEnterpriseAdmin
  );
}

export function canAccessStrategicPlanning(ctx: IdentityContext): boolean {
  return ctx.permissions.includes("executive.strategic") || ctx.isEnterpriseAdmin;
}

export function canAccessRiskIntelligence(ctx: IdentityContext): boolean {
  return (
    ctx.permissions.includes("executive.risk_view") ||
    ctx.permissions.includes("executive.intelligence") ||
    ctx.isEnterpriseAdmin
  );
}
