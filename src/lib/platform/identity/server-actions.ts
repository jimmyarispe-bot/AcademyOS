"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePermission } from "@/lib/platform/identity/permissions";
import { logSecurityEvent } from "@/lib/platform/identity/security";
import { upsertUserPreferences } from "@/lib/platform/identity/preferences";
import { startImpersonation, endImpersonation } from "@/lib/platform/identity/impersonation";

async function assertPermission(key: Parameters<typeof requirePermission>[1]) {
  const supabase = await createAuthClient();
  const gate = await requirePermission(supabase, key);
  if (!gate.ok) throw new Error(gate.error);
  return supabase;
}

export async function saveUserPreferencesAction(formData: FormData) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const result = await upsertUserPreferences(supabase, user.id, {
    timezone: (formData.get("timezone") as string) || "America/New_York",
    language: (formData.get("language") as string) || "en",
    theme: ((formData.get("theme") as string) || "system") as "light" | "dark" | "system",
    notifications: {
      email: formData.get("notify_email") === "true",
      sms: formData.get("notify_sms") === "true",
      dashboard: formData.get("notify_dashboard") === "true",
    },
    mission_control_widgets: {
      failedAutomations: formData.get("mc_failed") === "true",
      pendingTasks: formData.get("mc_tasks") === "true",
      queueStatus: formData.get("mc_queue") === "true",
    },
  });

  if (result.error) return { error: result.error };
  revalidatePath("/dashboard/settings/preferences");
  return { success: true };
}

export async function saveSchoolBrandingAction(formData: FormData) {
  const supabase = await assertPermission("school.configure");
  const schoolId = formData.get("school_id") as string;

  const { error } = await supabase.from("school_branding").upsert({
    school_id: schoolId,
    logo_url: (formData.get("logo_url") as string) || null,
    primary_color: (formData.get("primary_color") as string) || "#4F46E5",
    secondary_color: (formData.get("secondary_color") as string) || "#6366F1",
    accent_color: (formData.get("accent_color") as string) || "#818CF8",
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  await logSecurityEvent(supabase, {
    eventType: "school_config_change",
    schoolId,
    summary: "School branding updated",
  });

  revalidatePath("/dashboard/admin/schools");
  return { success: true };
}

export async function assignUserOrgScopeAction(formData: FormData) {
  const supabase = await assertPermission("users.manage");
  const userId = formData.get("user_id") as string;
  const schoolId = formData.get("school_id") as string;
  const allCampuses = formData.get("all_campuses") === "true";
  const allPrograms = formData.get("all_programs") === "true";

  const { error } = await supabase.from("user_org_assignments").upsert(
    {
      user_id: userId,
      school_id: schoolId,
      campus_id: null,
      program_id: null,
      department_id: null,
      all_campuses: allCampuses,
      all_programs: allPrograms,
    },
    { onConflict: "user_id,school_id,campus_id,program_id,department_id" }
  );

  if (error) return { error: error.message };

  await supabase.from("user_schools").upsert(
    { user_id: userId, school_id: schoolId },
    { onConflict: "user_id,school_id", ignoreDuplicates: true }
  );

  await logSecurityEvent(supabase, {
    eventType: "org_assignment_change",
    userId,
    schoolId,
    summary: "User org assignment updated",
  });

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function toggleRolePermissionAction(formData: FormData) {
  const supabase = await assertPermission("roles.manage");
  const roleId = formData.get("role_id") as string;
  const permissionKey = formData.get("permission_key") as string;
  const enabled = formData.get("enabled") === "true";

  if (enabled) {
    await supabase.from("platform_role_permissions").upsert(
      { role_id: roleId, permission_key: permissionKey, effect: "allow" },
      { onConflict: "role_id,permission_key" }
    );
  } else {
    await supabase
      .from("platform_role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_key", permissionKey);
  }

  await logSecurityEvent(supabase, {
    eventType: "permission_change",
    summary: `Permission ${permissionKey} ${enabled ? "granted" : "revoked"}`,
    metadata: { roleId, permissionKey },
  });

  revalidatePath("/dashboard/admin/roles");
  return { success: true };
}

export async function createCustomRoleAction(formData: FormData) {
  const supabase = await assertPermission("roles.manage");
  const name = (formData.get("name") as string).trim().toUpperCase().replace(/\s+/g, "_");
  const displayName = (formData.get("display_name") as string).trim();
  const description = (formData.get("description") as string) || null;
  const parentRoleName = (formData.get("parent_role") as string) || null;

  let parentRoleId: string | null = null;
  if (parentRoleName) {
    const { data: parent } = await supabase
      .from("roles")
      .select("id")
      .eq("name", parentRoleName)
      .maybeSingle();
    parentRoleId = parent?.id ?? null;
  }

  const { error } = await supabase.from("roles").insert({
    name,
    display_name: displayName,
    description,
    is_system: false,
    is_custom: true,
    parent_role_id: parentRoleId,
    sort_order: 500,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/roles");
  return { success: true };
}

export async function startImpersonationAction(formData: FormData) {
  const targetUserId = formData.get("target_user_id") as string;
  const reason = (formData.get("reason") as string) || "Support troubleshooting";
  const result = await startImpersonation(targetUserId, reason);
  if (result.error) return { error: result.error };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function endImpersonationAction() {
  const result = await endImpersonation();
  if (result.error) return { error: result.error };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateEmployeeDirectoryAction(formData: FormData) {
  const supabase = await assertPermission("hr.manage");
  const employeeId = formData.get("employee_id") as string;

  const { error } = await supabase
    .from("employee_profiles")
    .update({
      photo_url: (formData.get("photo_url") as string) || null,
      phone_extension: (formData.get("phone_extension") as string) || null,
      meet_link: (formData.get("meet_link") as string) || null,
      directory_visible: formData.get("directory_visible") !== "false",
      directory_sort_order: Number(formData.get("directory_sort_order")) || 0,
    })
    .eq("employee_id", employeeId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/directory");
  return { success: true };
}

export async function saveAuthorizedContactAction(formData: FormData) {
  const supabase = await assertPermission("students.edit");
  const studentId = formData.get("student_id") as string;

  const { error } = await supabase.from("student_authorized_contacts").insert({
    student_id: studentId,
    contact_type: (formData.get("contact_type") as string) || "other",
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    custody_notes: (formData.get("custody_notes") as string) || null,
    can_pick_up: formData.get("can_pick_up") === "true",
    receives_communications: formData.get("receives_communications") !== "false",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/families");
  return { success: true };
}
