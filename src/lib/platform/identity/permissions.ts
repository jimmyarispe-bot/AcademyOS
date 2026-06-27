import { NextResponse } from "next/server";
import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { PermissionKey } from "@/lib/platform/identity/types";
import type { EduRoleName } from "@/types/database";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const SUPER_ROLES: EduRoleName[] = ["CEO", "FOUNDER"];
const UNRESTRICTED_ROLES: EduRoleName[] = ["CEO", "FOUNDER", "EXECUTIVE_DIRECTOR"];
const ENTERPRISE_ADMIN_ROLES: EduRoleName[] = ["FOUNDER", "CEO", "EXECUTIVE_DIRECTOR"];

/** Used when enterprise permission tables/RPC are not deployed yet (runtime-verified fallback). */
const ROLE_PERMISSION_FALLBACK: Partial<Record<EduRoleName, PermissionKey[]>> = {
  CEO: ["certification.view", "certification.manage", "certification.admin"],
  FOUNDER: ["certification.view", "certification.manage", "certification.admin"],
  EXECUTIVE_DIRECTOR: ["certification.view", "certification.manage", "certification.admin"],
  SCHOOL_LEADER: ["certification.view"],
};

function hasUnrestrictedRole(roles: string[]): boolean {
  return roles.some((r) => UNRESTRICTED_ROLES.includes(r as EduRoleName));
}

function roleFallbackHasPermission(roles: string[], permissionKey: PermissionKey): boolean {
  return roles.some((role) => ROLE_PERMISSION_FALLBACK[role as EduRoleName]?.includes(permissionKey));
}

function collectRoleFallbackPermissions(roles: string[]): Set<string> {
  const allowed = new Set<string>();
  for (const role of roles) {
    for (const key of ROLE_PERMISSION_FALLBACK[role as EduRoleName] ?? []) {
      allowed.add(key);
    }
  }
  return allowed;
}

function isMissingPermissionInfraError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("has_permission") ||
    message.includes("platform_permissions") ||
    message.includes("platform_role_permissions") ||
    message.includes("user_role_ids")
  );
}

export function isFounderRole(roles: string[]): boolean {
  return roles.includes("FOUNDER");
}

export function isEnterpriseAdminRole(roles: string[]): boolean {
  return roles.some((r) => ENTERPRISE_ADMIN_ROLES.includes(r as EduRoleName));
}

/** Server-side permission check — mirrors has_permission() SQL function */
export async function userHasPermission(
  supabase: AuthClient,
  permissionKey: PermissionKey,
  userId?: string
): Promise<boolean> {
  const authUserId = (await supabase.auth.getUser()).data.user?.id;
  const sessionUserId = userId ?? authUserId;
  if (!sessionUserId) return false;

  const roles = await loadUserRoleNames(supabase, sessionUserId);

  if (sessionUserId === authUserId) {
    const { data, error } = await supabase.rpc("has_permission", {
      permission_key: permissionKey,
    });
    if (!error) return data === true;
    if (isMissingPermissionInfraError(error.message)) {
      return roleFallbackHasPermission(roles, permissionKey);
    }
    return false;
  }

  if (hasUnrestrictedRole(roles)) return true;

  const roleIds = await loadExpandedRoleIds(supabase, sessionUserId);
  if (!roleIds.length) return roleFallbackHasPermission(roles, permissionKey);

  const { data: perms, error } = await supabase
    .from("platform_role_permissions")
    .select("permission_key, effect")
    .in("role_id", roleIds)
    .eq("permission_key", permissionKey);

  if (error && isMissingPermissionInfraError(error.message)) {
    return roleFallbackHasPermission(roles, permissionKey);
  }

  if (perms?.some((p) => p.effect === "deny")) return false;
  return perms?.some((p) => p.effect === "allow") ?? roleFallbackHasPermission(roles, permissionKey);
}

export async function requirePermission(
  supabase: AuthClient,
  permissionKey: PermissionKey
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await userHasPermission(supabase, permissionKey);
  if (!allowed) return { ok: false, error: "Forbidden" };
  return { ok: true };
}

export async function loadUserPermissions(
  supabase: AuthClient,
  userId: string
): Promise<Set<string>> {
  const authUserId = (await supabase.auth.getUser()).data.user?.id;
  const roles = await loadUserRoleNames(supabase, userId);

  if (hasUnrestrictedRole(roles)) {
    const { data: all, error } = await supabase.from("platform_permissions").select("permission_key");
    if (!error) return new Set(all?.map((p) => p.permission_key) ?? []);
    return collectRoleFallbackPermissions(roles);
  }

  if (userId === authUserId) {
    const { data: all, error } = await supabase.from("platform_permissions").select("permission_key");
    if (error && isMissingPermissionInfraError(error.message)) {
      return collectRoleFallbackPermissions(roles);
    }
    const keys = all?.map((p) => p.permission_key) ?? [];
    const allowed = await Promise.all(
      keys.map(async (key) => ((await userHasPermission(supabase, key as PermissionKey, userId)) ? key : null))
    );
    return new Set(allowed.filter((key): key is string => Boolean(key)));
  }

  const roleIds = await loadExpandedRoleIds(supabase, userId);
  if (!roleIds.length) return collectRoleFallbackPermissions(roles);

  const { data: perms, error } = await supabase
    .from("platform_role_permissions")
    .select("permission_key, effect")
    .in("role_id", roleIds);

  if (error && isMissingPermissionInfraError(error.message)) {
    return collectRoleFallbackPermissions(roles);
  }

  const denied = new Set(perms?.filter((p) => p.effect === "deny").map((p) => p.permission_key));
  const allowed = new Set(
    perms?.filter((p) => p.effect === "allow" && !denied.has(p.permission_key)).map((p) => p.permission_key)
  );
  return allowed;
}

export async function getMissionControlModulesForUser(
  supabase: AuthClient,
  userId: string
): Promise<string[] | null> {
  const roles = await loadUserRoleNames(supabase, userId);
  if (roles.some((r) => SUPER_ROLES.includes(r as EduRoleName) || r === "EXECUTIVE_DIRECTOR")) {
    return null;
  }

  const permissions = await loadUserPermissions(supabase, userId);
  if (!permissions.has("mission_control.access")) return [];

  const modules: string[] = [];
  if (permissions.has("admissions.view") || permissions.has("admissions.manage")) modules.push("admissions");
  if (permissions.has("finance.view")) modules.push("finance");
  if (permissions.has("hr.view") || permissions.has("hr.manage")) modules.push("hr");
  if (permissions.has("executive.intelligence") || permissions.has("executive.dashboard")) modules.push("executive");
  if (permissions.has("scholarships.view")) modules.push("scholarships");
  if (permissions.has("funding.view")) modules.push("state_funding");
  if (permissions.has("students.view")) modules.push("sis");
  if (permissions.has("work.view") || permissions.has("work.manage")) modules.push("work");
  if (permissions.has("executive.dashboard")) modules.push("executive");
  return modules;
}

async function loadUserRoleNames(supabase: AuthClient, userId: string): Promise<string[]> {
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);

  const roleIds = userRoles?.map((r) => r.role_id) ?? [];
  if (!roleIds.length) return [];

  const { data: roles } = await supabase.from("roles").select("name").in("id", roleIds);
  return roles?.map((r) => r.name) ?? [];
}

async function loadExpandedRoleIds(supabase: AuthClient, userId: string): Promise<string[]> {
  const { data } = await supabase.rpc("user_role_ids", { check_user_id: userId });
  return (data as string[] | null) ?? [];
}

export function permissionDeniedResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
