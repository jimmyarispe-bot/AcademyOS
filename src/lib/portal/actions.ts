"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { assertParentStudentAccess, getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { logStudentCommunicationEvent } from "@/lib/ssis/timeline";
import { recordParentEngagementEvent } from "@/lib/ssis/engagement";
import { writePlatformAudit } from "@/lib/platform/automation/audit";
import { createPortalNotification } from "@/lib/portal/notifications";
import { upsertUserPreferences } from "@/lib/platform/identity/preferences";
import crypto from "crypto";

export async function sendPortalMessageAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const conversationId = formData.get("conversation_id") as string;
  const body = formData.get("body") as string;
  const category = (formData.get("category") as string) || "general";

  const { data: convo } = await supabase
    .from("portal_conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (!convo) return { error: "Conversation not found" };
  const allowed = await assertParentStudentAccess(supabase, user.id, convo.student_id);
  if (!allowed && convo.created_by_user_id !== user.id) {
    const { data: staff } = await supabase.from("students").select("school_id").eq("id", convo.student_id).single();
    if (!staff) return { error: "Access denied" };
  }

  const { data: message, error } = await supabase
    .from("portal_messages")
    .insert({
      conversation_id: conversationId,
      sender_user_id: user.id,
      body,
      message_category: category,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("portal_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  await logStudentCommunicationEvent(supabase, {
    studentId: convo.student_id,
    schoolId: convo.school_id,
    channel: "portal",
    direction: "inbound",
    subject: convo.subject,
    body,
    actorUserId: user.id,
    relatedEntityType: "portal_messages",
    relatedEntityId: message?.id,
  });

  await recordParentEngagementEvent(supabase, {
    studentId: convo.student_id,
    familyId: convo.family_id,
    eventType: "message_sent",
    summary: "Parent sent portal message",
    engagementScore: 2,
  });

  if (convo.assigned_staff_user_id) {
    await createPortalNotification(supabase, {
      userId: convo.assigned_staff_user_id,
      studentId: convo.student_id,
      familyId: convo.family_id,
      category: "message",
      title: `New message: ${convo.subject}`,
      body: body.slice(0, 200),
      href: `/dashboard/students/${convo.student_id}`,
    });
  }

  revalidatePath("/portal/messages");
  return { success: true };
}

export async function startPortalConversationAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const studentId = formData.get("student_id") as string;
  const allowed = await assertParentStudentAccess(supabase, user.id, studentId);
  if (!allowed) return { error: "Access denied" };

  const { data: student } = await supabase.from("students").select("school_id, family_id").eq("id", studentId).single();
  if (!student) return { error: "Student not found" };

  const { data: convo, error } = await supabase
    .from("portal_conversations")
    .insert({
      school_id: student.school_id,
      student_id: studentId,
      family_id: student.family_id,
      category: (formData.get("category") as string) || "general",
      subject: formData.get("subject") as string,
      created_by_user_id: user.id,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const fd = new FormData();
  fd.set("conversation_id", convo.id);
  fd.set("body", formData.get("body") as string);
  fd.set("category", (formData.get("category") as string) || "general");
  await sendPortalMessageAction(fd);

  revalidatePath("/portal/messages");
  return { success: true, conversationId: convo.id };
}

export async function markNotificationReadAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("notification_id") as string;
  await supabase
    .from("portal_family_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/portal/notifications");
  revalidatePath("/portal");
  return { success: true };
}

export async function markMessageReadAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await supabase.from("portal_message_reads").upsert({
    message_id: formData.get("message_id") as string,
    user_id: user.id,
    read_at: new Date().toISOString(),
  });

  return { success: true };
}

export async function requestConferenceAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const studentId = formData.get("student_id") as string;
  if (!(await assertParentStudentAccess(supabase, user.id, studentId))) {
    return { error: "Access denied" };
  }

  const { data: student } = await supabase.from("students").select("school_id").eq("id", studentId).single();
  if (!student) return { error: "Student not found" };

  const preferredTimes = JSON.parse((formData.get("preferred_times") as string) || "[]");

  const { error } = await supabase.from("portal_conference_requests").insert({
    student_id: studentId,
    school_id: student.school_id,
    requested_by_user_id: user.id,
    preferred_times: preferredTimes,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) return { error: error.message };

  await recordParentEngagementEvent(supabase, {
    studentId,
    eventType: "conference_requested",
    summary: "Parent requested conference",
    engagementScore: 3,
  });

  revalidatePath("/portal/conferences");
  return { success: true };
}

export async function respondToMeetingAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const meetingId = formData.get("meeting_id") as string;
  const response = formData.get("response") as string;

  const { data: meeting } = await supabase
    .from("student_instructional_meetings")
    .select("student_id")
    .eq("id", meetingId)
    .single();

  if (!meeting || !(await assertParentStudentAccess(supabase, user.id, meeting.student_id))) {
    return { error: "Access denied" };
  }

  await supabase
    .from("student_instructional_meetings")
    .update({ parent_response_status: response })
    .eq("id", meetingId);

  revalidatePath("/portal/conferences");
  return { success: true };
}

export async function submitPortalFormAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const studentId = (formData.get("student_id") as string) || null;
  if (studentId && !(await assertParentStudentAccess(supabase, user.id, studentId))) {
    return { error: "Access denied" };
  }

  const { error } = await supabase.from("portal_form_submissions").insert({
    template_id: formData.get("template_id") as string,
    student_id: studentId,
    family_id: (formData.get("family_id") as string) || null,
    submitted_by_user_id: user.id,
    answers: JSON.parse((formData.get("answers") as string) || "{}"),
    status: "submitted",
  });

  if (error) return { error: error.message };

  if (studentId) {
    await recordParentEngagementEvent(supabase, {
      studentId,
      eventType: "form_submitted",
      summary: "Parent submitted portal form",
      engagementScore: 2,
    });
  }

  await writePlatformAudit(supabase, {
    module: "parent_portal",
    entityType: "portal_form_submissions",
    entityId: formData.get("template_id") as string,
    actionType: "form_submitted",
    summary: "Family form submitted via portal",
    actorUserId: user.id,
  });

  revalidatePath("/portal/forms");
  return { success: true };
}

export async function updatePortalPreferencesAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const notifications = JSON.parse((formData.get("notifications") as string) || "{}");
  const accessibility = JSON.parse((formData.get("accessibility") as string) || "{}");

  await upsertUserPreferences(supabase, user.id, { notifications, accessibility });
  revalidatePath("/portal");
  return { success: true };
}

export async function recordPortalLoginAction(studentIds: string[]) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !studentIds.length) return;

  for (const studentId of studentIds.slice(0, 5)) {
    await recordParentEngagementEvent(supabase, {
      studentId,
      eventType: "portal_login",
      summary: "Parent portal login",
      engagementScore: 1,
    });
  }
}

export async function createCalendarExportTokenAction() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 365 * 86400000).toISOString();

  await supabase.from("portal_calendar_export_tokens").insert({
    user_id: user.id,
    token_hash: tokenHash,
    label: "Family calendar",
    expires_at: expiresAt,
  });

  return { success: true, token };
}

export async function getPortalStudentIdsForUser() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return getParentLinkedStudentIds(supabase, user.id);
}
