import type { createAuthClient } from "@/lib/supabase/server-auth";
import { publishCollaborationFeedEvent } from "@/lib/instruction/feed";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function ensureInstructionalTeam(supabase: AuthClient, studentId: string, schoolId: string) {
  const { data: existing } = await supabase
    .from("student_instructional_teams")
    .select("id")
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("student_instructional_teams")
    .insert({ student_id: studentId, school_id: schoolId })
    .select("id")
    .single();

  return created?.id;
}

const ASSIGNMENT_TO_TEAM_ROLE: Record<string, string> = {
  primary: "classroom_teacher",
  co_teacher: "classroom_teacher",
  teaching_assistant: "interventionist",
  therapist: "speech_therapist",
  substitute: "classroom_teacher",
  observer: "school_leader",
};

const SUBJECT_TO_TEAM_ROLE: Record<string, string> = {
  reading: "reading_teacher",
  structured_literacy: "structured_literacy_teacher",
  math: "math_teacher",
  speech: "speech_therapist",
  occupational_therapy: "occupational_therapist",
  physical_therapy: "physical_therapist",
  counseling: "counselor",
  behavior_support: "behavior_specialist",
};

export async function syncInstructionalTeamFromRoster(
  supabase: AuthClient,
  studentId: string,
  schoolId: string
) {
  const teamId = await ensureInstructionalTeam(supabase, studentId, schoolId);

  const { data: enrollments } = await supabase
    .from("student_enrollments")
    .select("course_section_id, course_sections(instructor_employee_id, courses(academy_subject))")
    .eq("student_id", studentId)
    .eq("enrollment_status", "enrolled");

  const staffCandidates: { employeeId: string; teamRole: string; isPrimary: boolean }[] = [];

  for (const enrollment of enrollments ?? []) {
    const cs = Array.isArray(enrollment.course_sections)
      ? enrollment.course_sections[0]
      : enrollment.course_sections;
    const course = Array.isArray(cs?.courses) ? cs.courses[0] : cs?.courses;
    const subject = (course as { academy_subject?: string })?.academy_subject;
    const subjectRole = subject ? SUBJECT_TO_TEAM_ROLE[subject] : undefined;

    if (cs?.instructor_employee_id) {
      staffCandidates.push({
        employeeId: cs.instructor_employee_id,
        teamRole: subjectRole ?? "classroom_teacher",
        isPrimary: true,
      });
    }
  }

  const sectionIds = (enrollments ?? [])
    .map((e) => e.course_section_id)
    .filter(Boolean) as string[];

  if (sectionIds.length) {
    const { data: assignments } = await supabase
      .from("section_staff_assignments")
      .select("employee_id, assignment_role, course_sections(courses(academy_subject))")
      .in("course_section_id", sectionIds)
      .eq("is_active", true);

    for (const assignment of assignments ?? []) {
      const cs = Array.isArray(assignment.course_sections)
        ? assignment.course_sections[0]
        : assignment.course_sections;
      const course = Array.isArray(cs?.courses) ? cs.courses[0] : cs?.courses;
      const subject = (course as { academy_subject?: string })?.academy_subject;
      const mappedRole =
        assignment.assignment_role === "therapist" && subject
          ? SUBJECT_TO_TEAM_ROLE[subject] ?? "speech_therapist"
          : ASSIGNMENT_TO_TEAM_ROLE[assignment.assignment_role] ?? "interventionist";

      staffCandidates.push({
        employeeId: assignment.employee_id,
        teamRole: mappedRole,
        isPrimary: assignment.assignment_role === "primary",
      });
    }
  }

  const { data: interventions } = await supabase
    .from("student_academic_interventions")
    .select("assigned_employee_id, intervention_type")
    .eq("student_id", studentId)
    .eq("status", "active")
    .not("assigned_employee_id", "is", null);

  for (const iv of interventions ?? []) {
    if (!iv.assigned_employee_id) continue;
    staffCandidates.push({
      employeeId: iv.assigned_employee_id,
      teamRole: "interventionist",
      isPrimary: false,
    });
  }

  for (const candidate of staffCandidates) {
    const { data: existing } = await supabase
      .from("student_instructional_team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("employee_id", candidate.employeeId)
      .eq("team_role", candidate.teamRole)
      .maybeSingle();

    if (existing) continue;

    await supabase.from("student_instructional_team_members").insert({
      team_id: teamId,
      employee_id: candidate.employeeId,
      team_role: candidate.teamRole,
      is_primary: candidate.isPrimary,
    });
  }

  return teamId;
}

export async function getStudentInstructionalTeam(supabase: AuthClient, studentId: string) {
  const { data: student } = await supabase.from("students").select("school_id").eq("id", studentId).single();
  if (student?.school_id) {
    await syncInstructionalTeamFromRoster(supabase, studentId, student.school_id);
  }

  const { data: team } = await supabase
    .from("student_instructional_teams")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!team) return { team: null, members: [] };

  const { data: members } = await supabase
    .from("student_instructional_team_members")
    .select("*, employees(id, employee_profiles(display_name, contact_email))")
    .eq("team_id", team.id)
    .eq("is_active", true)
    .order("is_primary", { ascending: false });

  return { team, members: members ?? [] };
}

export async function syncGrowthGoalsFromSsiss(supabase: AuthClient, studentId: string) {
  const [academicGoals, spedGoals, interventions] = await Promise.all([
    supabase.from("student_academic_goals").select("*").eq("student_id", studentId).eq("status", "active"),
    supabase
      .from("student_special_education_goals")
      .select("*, student_special_education_plans(plan_type)")
      .eq("student_id", studentId)
      .eq("status", "active"),
    supabase
      .from("student_academic_interventions")
      .select("*")
      .eq("student_id", studentId)
      .eq("status", "active"),
  ]);

  for (const g of academicGoals.data ?? []) {
    await upsertLinkedGoal(supabase, {
      studentId,
      goalSource: "academic",
      title: g.domain,
      description: g.goal_text,
      target: g.target_date,
      progressNotes: g.progress_notes,
      sourceEntityType: "student_academic_goals",
      sourceEntityId: g.id,
    });
  }

  for (const g of spedGoals.data ?? []) {
    const plan = Array.isArray(g.student_special_education_plans)
      ? g.student_special_education_plans[0]
      : g.student_special_education_plans;
    const planType = (plan as { plan_type?: string })?.plan_type ?? "iep";
    await upsertLinkedGoal(supabase, {
      studentId,
      goalSource: planType === "504" ? "504" : "iep",
      title: g.goal_area,
      description: g.goal_text,
      target: g.target_date,
      progressNotes: g.progress_notes,
      sourceEntityType: "student_special_education_goals",
      sourceEntityId: g.id,
    });
  }

  for (const iv of interventions.data ?? []) {
    await upsertLinkedGoal(supabase, {
      studentId,
      goalSource: "intervention",
      title: iv.intervention_type,
      description: iv.goal_text ?? iv.notes,
      target: iv.review_date,
      progressNotes: iv.notes,
      assignedEmployeeId: iv.assigned_employee_id,
      sourceEntityType: "student_academic_interventions",
      sourceEntityId: iv.id,
    });
  }
}

async function upsertLinkedGoal(
  supabase: AuthClient,
  input: {
    studentId: string;
    goalSource: string;
    title: string;
    description?: string | null;
    target?: string | null;
    progressNotes?: string | null;
    assignedEmployeeId?: string | null;
    sourceEntityType: string;
    sourceEntityId: string;
  }
) {
  const { data: existing } = await supabase
    .from("student_growth_goals")
    .select("id")
    .eq("source_entity_type", input.sourceEntityType)
    .eq("source_entity_id", input.sourceEntityId)
    .maybeSingle();

  if (existing) return;

  await supabase.from("student_growth_goals").insert({
    student_id: input.studentId,
    goal_source: input.goalSource,
    title: input.title,
    description: input.description,
    target: input.target ? String(input.target) : null,
    progress_notes: input.progressNotes,
    assigned_employee_id: input.assignedEmployeeId ?? null,
    source_entity_type: input.sourceEntityType,
    source_entity_id: input.sourceEntityId,
    status: "active",
  });
}

export async function getStudentGrowthPlan(supabase: AuthClient, studentId: string) {
  await syncGrowthGoalsFromSsiss(supabase, studentId);

  const { data: goals } = await supabase
    .from("student_growth_goals")
    .select("*, employees(id, employee_profiles(display_name))")
    .eq("student_id", studentId)
    .neq("status", "discontinued")
    .order("goal_source");

  return goals ?? [];
}

export async function updateGrowthGoalProgress(
  supabase: AuthClient,
  input: {
    goalId: string;
    studentId: string;
    progressPct: number;
    progressNotes?: string;
    evidence?: unknown[];
    actorUserId?: string;
    actorEmployeeId?: string;
  }
) {
  const status =
    input.progressPct >= 100 ? "met" : input.progressPct >= 70 ? "on_track" : input.progressPct >= 40 ? "active" : "at_risk";

  await supabase
    .from("student_growth_goals")
    .update({
      progress_pct: input.progressPct,
      progress_notes: input.progressNotes ?? null,
      evidence: input.evidence ?? [],
      status,
    })
    .eq("id", input.goalId);

  await publishCollaborationFeedEvent(supabase, {
    studentId: input.studentId,
    actorUserId: input.actorUserId,
    actorEmployeeId: input.actorEmployeeId,
    eventType: "goal_progress_updated",
    title: `Growth goal updated to ${input.progressPct}%`,
    body: input.progressNotes ?? "",
    relatedEntityType: "student_growth_goals",
    relatedEntityId: input.goalId,
  });
}
