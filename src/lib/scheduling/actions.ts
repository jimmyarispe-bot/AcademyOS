"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { generateSectionSessions } from "@/lib/scheduling/session-generator";
import { detectSchedulingConflicts, syncConflictsToMissionControl } from "@/lib/scheduling/conflicts";
import { recordSessionAttendance } from "@/lib/scheduling/attendance-bridge";
import { getIdentityContext } from "@/lib/platform/identity/context";

export async function generateSessionsAction(formData: FormData) {
  const supabase = await createAuthClient();
  const ctx = await getIdentityContext();
  if (!ctx?.permissions.includes("scheduling.generate")) {
    return { error: "Permission denied" };
  }

  const sectionId = formData.get("section_id") as string;
  const dateFrom = formData.get("date_from") as string;
  const dateTo = formData.get("date_to") as string;

  const result = await generateSectionSessions(supabase, {
    sectionId,
    dateFrom,
    dateTo,
    generatedBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/scheduling");
  return result;
}

export async function runSchedulingIntelligenceAction(formData: FormData) {
  const supabase = await createAuthClient();
  const ctx = await getIdentityContext();
  if (!ctx?.permissions.includes("scheduling.executive") && !ctx?.permissions.includes("scheduling.manage")) {
    return { error: "Permission denied" };
  }

  const schoolId =
    (formData.get("school_id") as string) ||
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    ctx.orgAssignments[0]?.school_id;
  if (!schoolId) return { error: "School required" };

  const conflicts = await detectSchedulingConflicts(supabase, schoolId);
  await syncConflictsToMissionControl(supabase, schoolId);

  revalidatePath("/dashboard/scheduling");
  return { success: true, conflictCount: conflicts.length };
}

export async function recordSessionAttendanceAction(formData: FormData) {
  const supabase = await createAuthClient();
  const ctx = await getIdentityContext();
  if (
    !ctx?.permissions.includes("scheduling.attendance") &&
    !ctx?.permissions.includes("students.attendance")
  ) {
    return { error: "Permission denied" };
  }

  const sessionId = formData.get("session_id") as string;
  const studentId = formData.get("student_id") as string;
  const status = formData.get("status") as string;
  const notes = (formData.get("notes") as string) || undefined;
  const notifyParent = formData.get("notify_parent") === "true";

  const result = await recordSessionAttendance(supabase, {
    sessionId,
    studentId,
    status,
    notes,
    notifyParent,
    recordedBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/scheduling");
  revalidatePath(`/dashboard/students/${studentId}`);
  return result;
}

export async function resolveScheduleConflictAction(formData: FormData) {
  const supabase = await createAuthClient();
  const ctx = await getIdentityContext();
  if (!ctx?.permissions.includes("scheduling.manage")) {
    return { error: "Permission denied" };
  }

  const conflictId = formData.get("conflict_id") as string;
  const { error } = await supabase
    .from("schedule_conflicts")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", conflictId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/scheduling");
  return { success: true };
}
