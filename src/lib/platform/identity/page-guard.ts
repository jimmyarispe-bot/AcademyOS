import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { userHasPermission } from "@/lib/platform/identity/permissions";
import type { PermissionKey } from "@/lib/platform/identity/types";

export async function requirePagePermission(permission: PermissionKey | PermissionKey[]) {
  const ctx = await getIdentityContext();
  if (!ctx) redirect("/login");

  if (ctx.isEnterpriseAdmin || ctx.isFounder) return ctx;

  const keys = Array.isArray(permission) ? permission : [permission];
  const supabase = await createAuthClient();

  for (const key of keys) {
    if (ctx.permissions.includes(key)) return ctx;
    if (await userHasPermission(supabase, key, ctx.effectiveUserId)) return ctx;
  }

  redirect("/dashboard");
}

export async function requireAuthenticatedIdentity() {
  const ctx = await getIdentityContext();
  if (!ctx) redirect("/login");
  return ctx;
}
