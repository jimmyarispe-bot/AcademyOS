"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { recordActivity } from "@/lib/platform/activity";
import { requirePermission } from "@/lib/platform/identity/permissions";
import { logSecurityEvent } from "@/lib/platform/identity/security";
import { upsertUserPreferences } from "@/lib/platform/identity/preferences";
import { startImpersonation, endImpersonation } from "@/lib/platform/identity/impersonation";
import { IMPERSONATION_COOKIE } from "@/lib/platform/identity/context";
import {
  extractSchoolOrganizationId,
  resolveActorUserId,
  resolveSchoolContext,
} from "@/lib/platform/shared/context";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

async function assertPermission(key: Parameters<typeof requirePermission>[1]) {
  const supabase = await createAuthClient();
  const gate = await requirePermission(supabase, key);
  if (!gate.ok) throw new Error(gate.error);
  return supabase;
}

/** Resolve tenant context for identity activity (school preferred, else org). */
async function resolveIdentityActivityContext(
  supabase: AuthClient,
  preferredSchoolId?: string | null
): Promise<{
  actorUserId: string | null;
  organizationId: string | null;
  schoolId: string | null;
}> {
  const actorUserId = await resolveActorUserId(supabase);

  if (preferredSchoolId) {
    const schoolCtx = await resolveSchoolContext(supabase, preferredSchoolId);
    return {
      actorUserId,
      schoolId: preferredSchoolId,
      organizationId: schoolCtx?.organizationId ?? null,
    };
  }

  if (actorUserId) {
    const { data: assignment } = await supabase
      .from("user_org_assignments")
      .select("school_id, is_primary, schools(organization_id)")
      .eq("user_id", actorUserId)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assignment?.school_id) {
      return {
        actorUserId,
        schoolId: assignment.school_id,
        organizationId: extractSchoolOrganizationId(assignment.schools),
      };
    }
  }

  const { data: org } = await supabase.from("org_organizations").select("id").limit(1).maybeSingle();
  return { actorUserId, schoolId: null, organizationId: org?.id ?? null };
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

  const ctx = await resolveIdentityActivityContext(supabase, schoolId);
  await recordActivity(supabase, {
    eventType: "identity.org_scope_assigned",
    moduleKey: "identity",
    entityType: "user",
    entityId: userId,
    title: "User org scope assigned",
    summary: `Org assignment updated for school ${schoolId}`,
    organizationId: ctx.organizationId,
    schoolId,
    actorUserId: ctx.actorUserId,
    relatedEntityType: "school",
    relatedEntityId: schoolId,
    payload: {
      target_user_id: userId,
      all_campuses: allCampuses,
      all_programs: allPrograms,
    },
    sourceTable: "user_org_assignments",
    sourceId: userId,
  });

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

/**
 * Take a school away from somebody.
 *
 * Until now this did not exist. `assignUserOrgScopeAction` upserts, and the
 * only deletes anywhere in the identity layer wipe every assignment a user has
 * as part of removing the user entirely. So school access could be granted and
 * never revoked — a person given the wrong campus kept it, and the screen that
 * appeared to set their schools only ever added to them.
 *
 * Two tables, because access is recorded in two: `user_org_assignments` carries
 * the scope, `user_schools` the membership. Leaving either behind leaves the
 * person with the school through the other one, which is the failure that looks
 * most like success.
 *
 * Logged as a security event. Granting access is routine; removing it is the
 * thing somebody asks about six months later.
 */
export async function removeUserOrgScopeAction(formData: FormData) {
  const supabase = await assertPermission("users.manage");
  const userId = formData.get("user_id") as string;
  const schoolId = formData.get("school_id") as string;
  if (!userId || !schoolId) return { error: "User and school required" };

  const { error: scopeError } = await supabase
    .from("user_org_assignments")
    .delete()
    .eq("user_id", userId)
    .eq("school_id", schoolId);
  if (scopeError) return { error: scopeError.message };

  const { error: membershipError } = await supabase
    .from("user_schools")
    .delete()
    .eq("user_id", userId)
    .eq("school_id", schoolId);
  if (membershipError) return { error: membershipError.message };

  await logSecurityEvent(supabase, {
    eventType: "org_assignment_change",
    userId,
    schoolId,
    summary: "School access removed",
  });

  const ctx = await resolveIdentityActivityContext(supabase, schoolId);
  await recordActivity(supabase, {
    eventType: "identity.org_scope_removed",
    moduleKey: "identity",
    entityType: "user",
    entityId: userId,
    title: "School access removed",
    summary: `School access removed for school ${schoolId}`,
    organizationId: ctx.organizationId,
    schoolId,
    actorUserId: ctx.actorUserId,
    relatedEntityType: "school",
    relatedEntityId: schoolId,
    payload: { target_user_id: userId },
    sourceTable: "user_org_assignments",
    sourceId: userId,
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

  const ctx = await resolveIdentityActivityContext(supabase);
  await recordActivity(supabase, {
    eventType: "identity.permission_changed",
    moduleKey: "identity",
    entityType: "role",
    entityId: roleId,
    title: "Role permission changed",
    summary: `Permission ${permissionKey} ${enabled ? "granted" : "revoked"}`,
    organizationId: ctx.organizationId,
    schoolId: ctx.schoolId,
    actorUserId: ctx.actorUserId,
    classification: "audit",
    visibility: "internal",
    payload: { role_id: roleId, permission_key: permissionKey, enabled },
    sourceTable: "platform_role_permissions",
    sourceId: roleId,
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

  const { data: role, error } = await supabase
    .from("roles")
    .insert({
      name,
      display_name: displayName,
      description,
      is_system: false,
      is_custom: true,
      parent_role_id: parentRoleId,
      sort_order: 500,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const ctx = await resolveIdentityActivityContext(supabase);
  await recordActivity(supabase, {
    eventType: "identity.role_created",
    moduleKey: "identity",
    entityType: "role",
    entityId: role.id,
    title: "Custom role created",
    summary: displayName || name,
    organizationId: ctx.organizationId,
    schoolId: ctx.schoolId,
    actorUserId: ctx.actorUserId,
    classification: "audit",
    visibility: "internal",
    payload: {
      role_name: name,
      display_name: displayName,
      parent_role_id: parentRoleId,
    },
    sourceTable: "roles",
    sourceId: role.id,
  });

  revalidatePath("/dashboard/admin/roles");
  return { success: true };
}

export async function startImpersonationAction(formData: FormData) {
  const targetUserId = formData.get("target_user_id") as string;
  const reason = (formData.get("reason") as string) || "Support troubleshooting";
  const result = await startImpersonation(targetUserId, reason);
  if (result.error) return { error: result.error };

  const supabase = await createAuthClient();
  const ctx = await resolveIdentityActivityContext(supabase);
  if (result.sessionId) {
    await recordActivity(supabase, {
      eventType: "identity.impersonation_started",
      moduleKey: "identity",
      entityType: "impersonation_session",
      entityId: result.sessionId,
      title: "Impersonation started",
      summary: `Impersonating user ${targetUserId}`,
      organizationId: ctx.organizationId,
      schoolId: ctx.schoolId,
      actorUserId: ctx.actorUserId,
      classification: "audit",
      visibility: "internal",
      relatedEntityType: "user",
      relatedEntityId: targetUserId,
      payload: { target_user_id: targetUserId, reason, session_id: result.sessionId },
      sourceTable: "platform_impersonation_sessions",
      sourceId: result.sessionId,
    });
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function endImpersonationAction() {
  const supabase = await createAuthClient();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
  let targetUserId: string | null = null;

  if (sessionId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: session } = await supabase
      .from("platform_impersonation_sessions")
      .select("target_user_id")
      .eq("id", sessionId)
      .eq("actor_user_id", user?.id ?? "")
      .maybeSingle();
    targetUserId = session?.target_user_id ?? null;
  }

  const result = await endImpersonation();
  if (result.error) return { error: result.error };

  if (sessionId) {
    const ctx = await resolveIdentityActivityContext(supabase);
    await recordActivity(supabase, {
      eventType: "identity.impersonation_ended",
      moduleKey: "identity",
      entityType: "impersonation_session",
      entityId: sessionId,
      title: "Impersonation ended",
      summary: targetUserId ? `Ended impersonation of ${targetUserId}` : "Impersonation ended",
      organizationId: ctx.organizationId,
      schoolId: ctx.schoolId,
      actorUserId: ctx.actorUserId,
      classification: "audit",
      visibility: "internal",
      relatedEntityType: targetUserId ? "user" : null,
      relatedEntityId: targetUserId,
      payload: { target_user_id: targetUserId, session_id: sessionId },
      sourceTable: "platform_impersonation_sessions",
      sourceId: sessionId,
    });
  }

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
