import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getTeacherEmployeeId } from "@/lib/teacher/queries";
import { getStaffWorkload } from "@/lib/scheduling/queries";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getEmployeeSelfServiceDashboard(supabase: AuthClient, userId: string) {
  const employeeId = await getTeacherEmployeeId(supabase, userId);
  if (!employeeId) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("*, employee_profiles(*), schools(name)")
    .eq("id", employeeId)
    .single();

  const [leave, training, onboarding, payroll, notifications] = await Promise.all([
    supabase.from("leave_requests").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(5),
    supabase.from("employee_training_records").select("*").eq("employee_id", employeeId).neq("status", "completed"),
    supabase.from("hr_onboarding_tasks").select("*").eq("employee_id", employeeId).neq("status", "completed"),
    supabase.from("payroll_records").select("*").eq("employee_id", employeeId).order("pay_period_end", { ascending: false }).limit(6),
    supabase.from("portal_family_notifications").select("*").eq("user_id", userId).eq("is_read", false).limit(5),
  ]);

  const workload = employee?.school_id ? await getStaffWorkload(employee.school_id) : [];
  const myWorkload = workload.find((w) => w.employeeId === employeeId);

  return {
    employee,
    employeeId,
    pendingLeave: leave.data ?? [],
    pendingTraining: training.data ?? [],
    pendingOnboarding: onboarding.data ?? [],
    payrollHistory: payroll.data ?? [],
    notifications: notifications.data ?? [],
    workload: myWorkload,
  };
}
