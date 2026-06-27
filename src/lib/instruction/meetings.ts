import type { createAuthClient } from "@/lib/supabase/server-auth";
import { logStudentCommunicationEvent } from "@/lib/ssis/timeline";
import { publishCollaborationFeedEvent } from "@/lib/instruction/feed";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getStudentMeetings(supabase: AuthClient, studentId: string) {
  const { data } = await supabase
    .from("student_instructional_meetings")
    .select("*")
    .eq("student_id", studentId)
    .order("scheduled_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function createInstructionalMeeting(
  supabase: AuthClient,
  input: {
    studentId: string;
    schoolId: string;
    meetingType: string;
    title: string;
    scheduledAt?: string;
    agenda?: string;
    createdBy?: string | null;
    actorEmployeeId?: string | null;
  }
) {
  const { data: meeting } = await supabase
    .from("student_instructional_meetings")
    .insert({
      student_id: input.studentId,
      school_id: input.schoolId,
      meeting_type: input.meetingType,
      title: input.title,
      scheduled_at: input.scheduledAt ?? null,
      agenda: input.agenda ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  await logStudentCommunicationEvent(supabase, {
    studentId: input.studentId,
    schoolId: input.schoolId,
    channel: "meeting",
    direction: "internal",
    subject: input.title,
    body: input.agenda ?? `Scheduled ${input.meetingType.replace(/_/g, " ")}`,
    actorUserId: input.createdBy,
    relatedEntityType: "student_instructional_meetings",
    relatedEntityId: meeting?.id,
  });

  await publishCollaborationFeedEvent(supabase, {
    studentId: input.studentId,
    schoolId: input.schoolId,
    actorUserId: input.createdBy,
    actorEmployeeId: input.actorEmployeeId,
    eventType: "meeting_scheduled",
    title: input.title,
    body: input.agenda ?? "",
    relatedEntityType: "student_instructional_meetings",
    relatedEntityId: meeting?.id,
  });

  if (input.scheduledAt) {
    await createMissionControlItem(supabase, {
      schoolId: input.schoolId,
      module: "teacher_portal",
      itemType: "teacher_compliance_alert",
      title: `Upcoming: ${input.title}`,
      body: input.agenda ?? "",
      href: `/dashboard/teacher/students/${input.studentId}?view=meetings`,
      entityType: "students",
      entityId: input.studentId,
    });
  }

  return meeting;
}

export async function completeInstructionalMeeting(
  supabase: AuthClient,
  input: {
    meetingId: string;
    studentId: string;
    schoolId: string;
    notes?: string;
    decisions?: string;
    followUpDate?: string;
    taskTitle?: string;
    taskDueDate?: string;
    assignedEmployeeId?: string | null;
    actorUserId?: string | null;
    actorEmployeeId?: string | null;
  }
) {
  await supabase
    .from("student_instructional_meetings")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      notes: input.notes ?? null,
      decisions: input.decisions ?? null,
      follow_up_date: input.followUpDate ?? null,
    })
    .eq("id", input.meetingId);

  if (input.taskTitle) {
    await supabase.from("student_instructional_meeting_tasks").insert({
      meeting_id: input.meetingId,
      assigned_employee_id: input.assignedEmployeeId ?? null,
      title: input.taskTitle,
      due_date: input.taskDueDate ?? null,
      status: "open",
    });
  }

  await logStudentCommunicationEvent(supabase, {
    studentId: input.studentId,
    schoolId: input.schoolId,
    channel: "meeting",
    direction: "internal",
    subject: "Meeting completed",
    body: input.decisions ?? input.notes ?? "Instructional meeting documented",
    actorUserId: input.actorUserId,
    relatedEntityType: "student_instructional_meetings",
    relatedEntityId: input.meetingId,
  });

  await publishCollaborationFeedEvent(supabase, {
    studentId: input.studentId,
    schoolId: input.schoolId,
    actorUserId: input.actorUserId,
    actorEmployeeId: input.actorEmployeeId,
    eventType: "meeting_completed",
    title: "Meeting documented",
    body: input.decisions ?? input.notes ?? "",
    relatedEntityType: "student_instructional_meetings",
    relatedEntityId: input.meetingId,
  });

  if (input.followUpDate) {
    const { enqueueMeetingFollowUpReminder } = await import("@/lib/instruction/automation");
    await enqueueMeetingFollowUpReminder(supabase, {
      meetingId: input.meetingId,
      studentId: input.studentId,
      schoolId: input.schoolId,
      followUpDate: input.followUpDate,
      title: "Meeting follow-up",
    });
  }
}

export async function getTeacherMeetings(supabase: AuthClient, employeeId: string) {
  const { data: participantMeetings } = await supabase
    .from("student_instructional_meeting_participants")
    .select("meeting_id")
    .eq("employee_id", employeeId);

  const ids = (participantMeetings ?? []).map((p) => p.meeting_id);
  if (!ids.length) {
    const { data: tasks } = await supabase
      .from("student_instructional_meeting_tasks")
      .select("meeting_id")
      .eq("assigned_employee_id", employeeId);
    const taskMeetingIds = (tasks ?? []).map((t) => t.meeting_id);
    if (!taskMeetingIds.length) return [];
    const { data } = await supabase
      .from("student_instructional_meetings")
      .select("*, students(first_name, last_name)")
      .in("id", taskMeetingIds)
      .order("scheduled_at", { ascending: false })
      .limit(20);
    return data ?? [];
  }

  const { data } = await supabase
    .from("student_instructional_meetings")
    .select("*, students(first_name, last_name)")
    .in("id", ids)
    .order("scheduled_at", { ascending: false })
    .limit(20);

  return data ?? [];
}
