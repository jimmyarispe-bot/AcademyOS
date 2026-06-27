import type { createAuthClient } from "@/lib/supabase/server-auth";
import { publishCollaborationFeedEvent } from "@/lib/instruction/feed";
import { computeStudentSuccessScore } from "@/lib/ssis/score";
import { logStudentCommunicationEvent } from "@/lib/ssis/timeline";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function recordSessionOutcome(
  supabase: AuthClient,
  input: {
    sessionId: string;
    studentId?: string | null;
    skillsAddressed?: string[];
    learningObjectives?: string[];
    studentResponse?: string;
    masteryLevel?: string;
    evidenceCollected?: unknown[];
    recommendedNextSteps?: string;
    homeworkPractice?: string;
    followUpTasks?: string[];
    growthGoalId?: string | null;
    recordedBy?: string | null;
    actorEmployeeId?: string | null;
  }
) {
  const { data: session } = await supabase
    .from("instructional_sessions")
    .select("course_section_id, course_sections(courses(school_id))")
    .eq("id", input.sessionId)
    .single();

  const cs = Array.isArray(session?.course_sections) ? session.course_sections[0] : session?.course_sections;
  const course = cs?.courses;
  const schoolId = (Array.isArray(course) ? course[0] : course)?.school_id as string | undefined;

  await supabase.from("instructional_session_outcomes").upsert(
    {
      instructional_session_id: input.sessionId,
      student_id: input.studentId ?? null,
      skills_addressed: input.skillsAddressed ?? [],
      learning_objectives: input.learningObjectives ?? [],
      student_response: input.studentResponse ?? null,
      mastery_level: input.masteryLevel ?? null,
      evidence_collected: input.evidenceCollected ?? [],
      recommended_next_steps: input.recommendedNextSteps ?? null,
      homework_practice: input.homeworkPractice ?? null,
      follow_up_tasks: input.followUpTasks ?? [],
      growth_goal_id: input.growthGoalId ?? null,
      recorded_by: input.recordedBy ?? null,
    },
    { onConflict: "instructional_session_id,student_id" }
  );

  if (input.studentId) {
    await logStudentCommunicationEvent(supabase, {
      studentId: input.studentId,
      schoolId,
      channel: "instruction",
      direction: "internal",
      subject: "Session outcome recorded",
      body: input.recommendedNextSteps ?? input.studentResponse ?? "Instructional session completed with documented outcomes",
      actorUserId: input.recordedBy,
      relatedEntityType: "instructional_sessions",
      relatedEntityId: input.sessionId,
    });

    await publishCollaborationFeedEvent(supabase, {
      studentId: input.studentId,
      schoolId,
      actorUserId: input.recordedBy,
      actorEmployeeId: input.actorEmployeeId,
      eventType: "session_outcome_recorded",
      title: "Session outcome documented",
      body: input.recommendedNextSteps ?? "",
      relatedEntityType: "instructional_sessions",
      relatedEntityId: input.sessionId,
    });

    await computeStudentSuccessScore(supabase, input.studentId);

    if (input.followUpTasks?.length && schoolId) {
      const { enqueueSessionFollowUpTasks } = await import("@/lib/instruction/automation");
      await enqueueSessionFollowUpTasks(supabase, {
        sessionId: input.sessionId,
        studentId: input.studentId,
        schoolId,
        tasks: input.followUpTasks,
      });
    }
  }
}

export async function getSessionOutcomes(supabase: AuthClient, sessionId: string) {
  const { data } = await supabase
    .from("instructional_session_outcomes")
    .select("*")
    .eq("instructional_session_id", sessionId);
  return data ?? [];
}
