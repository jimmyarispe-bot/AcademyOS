import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canAccessOperationsCenter } from "@/lib/operations-platform/access";
import type { PermissionKey } from "@/lib/platform/identity/types";

export async function requireOperationsPermission(permission?: PermissionKey | PermissionKey[]) {
  const ctx = await getIdentityContext();
  if (!ctx || !canAccessOperationsCenter(ctx)) redirect("/dashboard");

  if (permission) {
    const keys = Array.isArray(permission) ? permission : [permission];
    const isSuper = ctx.isEnterpriseAdmin || ctx.permissions.includes("operations.manage") || ctx.permissions.includes("cloud.admin");
    const allowed = isSuper || keys.some((k) => ctx.permissions.includes(k));
    if (!allowed) redirect("/operations");
  }

  return ctx;
}
