import type { createAuthClient } from "@/lib/supabase/server-auth";
import { enqueuePlatformJob } from "@/lib/platform/automation/queue";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function enqueueGrowthGoalReviewReminder(
  supabase: AuthClient,
  input: { goalId: string; studentId: string; schoolId: string; reviewDate: string; title: string }
) {
  await enqueuePlatformJob(supabase, {
    schoolId: input.schoolId,
    module: "teacher_portal",
    jobType: "growth_goal_review_reminder",
    entityType: "student_growth_goals",
    entityId: input.goalId,
    scheduledFor: `${input.reviewDate}T08:00:00.000Z`,
    payload: { student_id: input.studentId, title: input.title },
  });
}

export async function enqueueMeetingFollowUpReminder(
  supabase: AuthClient,
  input: { meetingId: string; studentId: string; schoolId: string; followUpDate: string; title: string }
) {
  await enqueuePlatformJob(supabase, {
    schoolId: input.schoolId,
    module: "teacher_portal",
    jobType: "meeting_follow_up_reminder",
    entityType: "student_instructional_meetings",
    entityId: input.meetingId,
    scheduledFor: `${input.followUpDate}T08:00:00.000Z`,
    payload: { student_id: input.studentId, title: input.title },
  });
}

export async function enqueueSessionFollowUpTasks(
  supabase: AuthClient,
  input: { sessionId: string; studentId: string; schoolId: string; tasks: string[] }
) {
  if (!input.tasks.length) return;
  await enqueuePlatformJob(supabase, {
    schoolId: input.schoolId,
    module: "teacher_portal",
    jobType: "session_follow_up_tasks",
    entityType: "instructional_sessions",
    entityId: input.sessionId,
    payload: { student_id: input.studentId, tasks: input.tasks },
  });
}

/** Process instruction-related queue reminders → Mission Control items */
export async function processInstructionReminders(supabase: AuthClient) {
  const now = new Date().toISOString();
  const { data: jobs } = await supabase
    .from("platform_queue_jobs")
    .select("*")
    .eq("module", "teacher_portal")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .in("job_type", ["growth_goal_review_reminder", "meeting_follow_up_reminder", "session_follow_up_tasks"])
    .limit(25);

  for (const job of jobs ?? []) {
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    const studentId = payload.student_id as string | undefined;
    const title = payload.title as string | undefined;
    const tasks = payload.tasks as string[] | undefined;

    let itemTitle = title ?? "Instruction follow-up";
    let body = "";

    if (job.job_type === "session_follow_up_tasks" && tasks?.length) {
      itemTitle = "Session follow-up tasks due";
      body = tasks.join("; ");
    } else if (job.job_type === "growth_goal_review_reminder") {
      itemTitle = `Goal review due: ${title ?? "Growth goal"}`;
    } else if (job.job_type === "meeting_follow_up_reminder") {
      itemTitle = `Meeting follow-up: ${title ?? "Instructional meeting"}`;
    }

    await createMissionControlItem(supabase, {
      schoolId: job.school_id,
      module: "teacher_portal",
      itemType: "teacher_compliance_alert",
      title: itemTitle,
      body,
      href: studentId ? `/dashboard/teacher/students/${studentId}` : "/dashboard/teacher",
      entityType: job.entity_type,
      entityId: job.entity_id,
    });

    await supabase
      .from("platform_queue_jobs")
      .update({ status: "completed", completed_at: now })
      .eq("id", job.id);
  }
}

/** Scan upcoming goal review dates and meeting follow-ups not yet queued */
export async function syncInstructionReminderJobs(supabase: AuthClient) {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const { data: goals } = await supabase
    .from("student_growth_goals")
    .select("id, student_id, title, review_date, students(school_id)")
    .gte("review_date", today)
    .lte("review_date", horizon)
    .neq("status", "met");

  for (const g of goals ?? []) {
    if (!g.review_date) continue;
    const st = Array.isArray(g.students) ? g.students[0] : g.students;
    const schoolId = (st as { school_id?: string })?.school_id;
    if (!schoolId) continue;

    const { data: existing } = await supabase
      .from("platform_queue_jobs")
      .select("id")
      .eq("entity_type", "student_growth_goals")
      .eq("entity_id", g.id)
      .eq("job_type", "growth_goal_review_reminder")
      .maybeSingle();

    if (!existing) {
      await enqueueGrowthGoalReviewReminder(supabase, {
        goalId: g.id,
        studentId: g.student_id,
        schoolId,
        reviewDate: g.review_date,
        title: g.title,
      });
    }
  }

  const { data: meetings } = await supabase
    .from("student_instructional_meetings")
    .select("id, student_id, title, follow_up_date, school_id")
    .gte("follow_up_date", today)
    .lte("follow_up_date", horizon)
    .eq("status", "completed");

  for (const m of meetings ?? []) {
    if (!m.follow_up_date) continue;
    const { data: existing } = await supabase
      .from("platform_queue_jobs")
      .select("id")
      .eq("entity_type", "student_instructional_meetings")
      .eq("entity_id", m.id)
      .eq("job_type", "meeting_follow_up_reminder")
      .maybeSingle();

    if (!existing) {
      await enqueueMeetingFollowUpReminder(supabase, {
        meetingId: m.id,
        studentId: m.student_id,
        schoolId: m.school_id,
        followUpDate: m.follow_up_date,
        title: m.title,
      });
    }
  }
}
