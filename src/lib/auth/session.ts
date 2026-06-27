import type { EduRoleName } from "@/types/database";
import { createAuthClient } from "@/lib/supabase/server-auth";

const ROLE_LABELS: Partial<Record<EduRoleName, string>> = {
  CEO: "Chief Executive Officer",
  FOUNDER: "Founder",
  EXECUTIVE_DIRECTOR: "Executive Director",
  REGIONAL_DIRECTOR: "Regional Director",
  SCHOOL_LEADER: "School Leader",
  ADMISSIONS: "Admissions",
  FINANCE: "Finance",
  HR: "Human Resources",
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
  EMPLOYEE: "Employee",
};

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roles: EduRoleName[];
  primaryRole: EduRoleName | null;
  roleLabel: string;
}

export function formatRoleLabel(role: EduRoleName | null): string {
  if (!role) return "Team Member";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createAuthClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: userRoleRows } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id);

  const roleIds = userRoleRows?.map((row) => row.role_id) ?? [];

  let roles: EduRoleName[] = [];
  if (roleIds.length > 0) {
    const { data: roleRows } = await supabase
      .from("roles")
      .select("name")
      .in("id", roleIds);

    roles =
      roleRows
        ?.map((row) => row.name)
        .filter((name): name is EduRoleName => Boolean(name)) ?? [];
  }

  const primaryRole = roles[0] ?? null;
  const email = profile?.email ?? user.email ?? "";
  const fullName =
    profile?.full_name?.trim() ||
    email.split("@")[0]?.replace(/\./g, " ") ||
    "User";

  return {
    id: user.id,
    email,
    fullName,
    roles,
    primaryRole,
    roleLabel: formatRoleLabel(primaryRole),
  };
}
