import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { getTeacherComplianceItems } from "@/lib/teacher/queries";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function syncTeacherComplianceToMissionControl(supabase: AuthClient) {
  const { data: employees } = await supabase
    .from("employees")
    .select("id, school_id, user_id")
    .eq("employment_status", "active")
    .in("employee_type", ["teacher", "contractor"]);

  for (const emp of employees ?? []) {
    const items = await getTeacherComplianceItems(supabase, emp.id);
    const critical = items.filter((i) => i.severity === "high");

    for (const item of critical.slice(0, 3)) {
      await createMissionControlItem(supabase, {
        schoolId: emp.school_id,
        module: "teacher_portal",
        itemType: "teacher_compliance_alert",
        title: item.title,
        body: `Teacher compliance: ${item.type}`,
        severity: "high",
        entityType: "employees",
        entityId: emp.id,
        href: item.href ?? "/dashboard/teacher?view=compliance",
      });
    }
  }
}
