import type { IdentityContext } from "@/lib/platform/identity/context";

export function canViewIntelligencePlatform(ctx: IdentityContext) {
  return (
    ctx.permissions.includes("ai.view") ||
    ctx.permissions.includes("ai.use") ||
    ctx.permissions.includes("ai.manage") ||
    ctx.permissions.includes("ai.admin") ||
    ctx.isEnterpriseAdmin
  );
}

export function canUseAi(ctx: IdentityContext) {
  return ctx.permissions.includes("ai.use") || ctx.permissions.includes("ai.admin") || ctx.isEnterpriseAdmin;
}

export function canManageAi(ctx: IdentityContext) {
  return ctx.permissions.includes("ai.manage") || ctx.permissions.includes("ai.admin") || ctx.isEnterpriseAdmin;
}

export function canManageProviders(ctx: IdentityContext) {
  return ctx.permissions.includes("ai.providers") || ctx.permissions.includes("ai.admin") || ctx.isEnterpriseAdmin;
}

export function canManagePrompts(ctx: IdentityContext) {
  return ctx.permissions.includes("ai.prompts") || ctx.permissions.includes("ai.manage") || ctx.permissions.includes("ai.admin") || ctx.isEnterpriseAdmin;
}

export function canTestAi(ctx: IdentityContext) {
  return ctx.permissions.includes("ai.testing") || ctx.permissions.includes("ai.admin") || ctx.isEnterpriseAdmin;
}

export function canAdminAi(ctx: IdentityContext) {
  return ctx.permissions.includes("ai.admin") || ctx.isEnterpriseAdmin;
}
