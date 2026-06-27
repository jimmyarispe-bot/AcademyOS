import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function processSpedReviewReminders(supabase: AuthClient) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const horizonStr = horizon.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const { data: reminders } = await supabase
    .from("sis_sped_review_reminders")
    .select(
      "id, student_id, plan_id, reminder_type, due_date, student_special_education_plans(plan_type), students(first_name, last_name, school_id)"
    )
    .eq("is_sent", false)
    .lte("due_date", horizonStr)
    .gte("due_date", today);

  for (const reminder of reminders ?? []) {
    const studentRaw = reminder.students;
    const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
    const planRaw = reminder.student_special_education_plans;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    if (!student) continue;

    const label =
      reminder.reminder_type === "annual_review"
        ? "Annual IEP/504 review"
        : reminder.reminder_type === "reevaluation"
          ? "Reevaluation due"
          : "Evaluation due";

    await createMissionControlItem(supabase, {
      schoolId: student.school_id,
      module: "sis",
      itemType: "pending_task",
      title: `${label}: ${student.first_name} ${student.last_name}`,
      body: `${plan?.plan_type?.toUpperCase() ?? "SPED"} review due ${reminder.due_date}`,
      entityType: "student",
      entityId: reminder.student_id,
      href: `/dashboard/students/${reminder.student_id}?tab=special-ed`,
      assignedRole: "REGISTRAR",
      severity: "high",
    });

    await supabase
      .from("sis_sped_review_reminders")
      .update({ is_sent: true, sent_at: new Date().toISOString() })
      .eq("id", reminder.id);
  }
}
