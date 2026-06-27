import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canAccessCloudConsole } from "@/lib/cloud-platform/access";
import type { PermissionKey } from "@/lib/platform/identity/types";

/** Cloud Console guard — AcademyOS employees with cloud.* permissions only */
export async function requireCloudPermission(permission?: PermissionKey | PermissionKey[]) {
  const ctx = await getIdentityContext();
  if (!ctx || !canAccessCloudConsole(ctx)) redirect("/dashboard");

  if (permission) {
    const keys = Array.isArray(permission) ? permission : [permission];
    const isSuper = ctx.isEnterpriseAdmin || ctx.permissions.includes("cloud.admin");
    const allowed = isSuper || keys.some((k) => ctx.permissions.includes(k));
    if (!allowed) redirect("/cloud");
  }

  return ctx;
}
