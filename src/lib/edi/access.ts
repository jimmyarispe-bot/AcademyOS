import type { IdentityContext } from "@/lib/platform/identity/context";

export function canViewEdi(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("edi.view") ||
    ctx.permissions.includes("edi.executive") ||
    ctx.permissions.includes("edi.manage") ||
    ctx.permissions.includes("edi.board") ||
    ctx.permissions.includes("executive.intelligence") ||
    ctx.isEnterpriseAdmin
  );
}

export function canManageEdi(ctx: IdentityContext) {
  return ctx.permissions.includes("edi.manage") || ctx.permissions.includes("edi.executive") || ctx.isEnterpriseAdmin;
}

export function canAccessEdiBoard(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("edi.board") ||
    ctx.permissions.includes("executive.board_reports") ||
    ctx.permissions.includes("edi.executive") ||
    ctx.isEnterpriseAdmin
  );
}
