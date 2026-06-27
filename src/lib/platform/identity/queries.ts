import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getOrganizationHierarchy } from "@/lib/platform/identity/org";
import { getImpersonationHistory } from "@/lib/platform/identity/impersonation";
import {
  getRecentSecurityEvents,
  getSecurityDashboardStats,
} from "@/lib/platform/identity/security";

export async function getAdminUsersDirectory() {
  const supabase = await createAuthClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name, created_at")
    .order("full_name");

  const { data: userRoles } = await supabase.from("user_roles").select("user_id, role_id, roles(name, display_name)");
  const { data: assignments } = await supabase
    .from("user_org_assignments")
    .select("user_id, school_id, all_campuses, all_programs, schools(name)");

  return (users ?? []).map((user) => ({
    ...user,
    roles:
      userRoles
        ?.filter((ur) => ur.user_id === user.id)
        .map((ur) => {
          const role = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
          return (role as { display_name?: string | null; name?: string } | null)?.display_name ?? role?.name;
        })
        .filter((name): name is string => Boolean(name)) ?? [],
    schools:
      assignments
        ?.filter((a) => a.user_id === user.id)
        .map((a) => {
          const school = Array.isArray(a.schools) ? a.schools[0] : a.schools;
          return (school as { name?: string } | null)?.name;
        })
        .filter((name): name is string => Boolean(name)) ?? [],
  }));
}

export async function getRolesWithPermissions() {
  const supabase = await createAuthClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("*")
    .order("sort_order");

  const { data: permissions } = await supabase
    .from("platform_permissions")
    .select("*")
    .order("sort_order");

  const { data: rolePerms } = await supabase
    .from("platform_role_permissions")
    .select("role_id, permission_key, effect");

  return {
    roles: roles ?? [],
    permissions: permissions ?? [],
    rolePermissions: rolePerms ?? [],
  };
}

export async function getStaffDirectoryEntries(schoolId?: string) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("employees")
    .select(`
      id, school_id, employment_status, employee_type,
      employee_profiles(
        display_name, first_name, last_name, job_title, contact_email, contact_phone,
        photo_url, phone_extension, meet_link, campus_id, directory_visible, directory_sort_order
      ),
      employee_positions(
        is_primary,
        positions(title, department)
      ),
      schools(name)
    `)
    .eq("employment_status", "active");

  if (schoolId) query = query.eq("school_id", schoolId);

  const { data } = await query.order("created_at");
  return (data ?? [])
    .filter((row) => {
      const profile = Array.isArray(row.employee_profiles)
        ? row.employee_profiles[0]
        : row.employee_profiles;
      return (profile as { directory_visible?: boolean } | null)?.directory_visible !== false;
    })
    .map((row) => {
      const positions = (row.employee_positions ?? []).map((ep: {
        is_primary: boolean;
        positions: { title: string; department: string | null } | { title: string; department: string | null }[] | null;
      }) => ({
        is_primary: ep.is_primary,
        positions: Array.isArray(ep.positions) ? ep.positions[0] ?? null : ep.positions,
      }));

      return {
        ...row,
        schools: Array.isArray(row.schools) ? row.schools[0] ?? null : row.schools,
        employee_profiles: Array.isArray(row.employee_profiles)
          ? row.employee_profiles[0] ?? null
          : row.employee_profiles,
        employee_positions: positions,
      };
    });
}

export async function getAdminDashboardData() {
  const supabase = await createAuthClient();
  const ctx = await getIdentityContext();
  const [hierarchy, securityStats, securityEvents, impersonationHistory] = await Promise.all([
    getOrganizationHierarchy(),
    getSecurityDashboardStats(supabase),
    getRecentSecurityEvents(supabase, 20),
    getImpersonationHistory(20),
  ]);

  return { ctx, hierarchy, securityStats, securityEvents, impersonationHistory };
}
