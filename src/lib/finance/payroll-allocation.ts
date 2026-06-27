import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function allocatePayrollFromScheduling(
  supabase: AuthClient,
  input: {
    employeeId: string;
    schoolId: string;
    payrollRecordId?: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
  }
) {
  const { data: sessions } = await supabase
    .from("instructional_sessions")
    .select("id, scheduled_start, scheduled_end, course_sections(courses(program))")
    .eq("instructor_employee_id", input.employeeId)
    .gte("scheduled_start", `${input.periodStart}T00:00:00`)
    .lte("scheduled_start", `${input.periodEnd}T23:59:59`);

  const programMinutes: Record<string, number> = {};
  let totalMinutes = 0;

  for (const s of sessions ?? []) {
    const mins = (new Date(s.scheduled_end).getTime() - new Date(s.scheduled_start).getTime()) / 60000;
    const cs = Array.isArray(s.course_sections) ? s.course_sections[0] : s.course_sections;
    const course = cs?.courses;
    const c = Array.isArray(course) ? course[0] : course;
    const program = (c as { program?: string })?.program ?? "general";
    programMinutes[program] = (programMinutes[program] ?? 0) + mins;
    totalMinutes += mins;
  }

  if (!totalMinutes) {
    await supabase.from("payroll_cost_allocations").insert({
      payroll_record_id: input.payrollRecordId ?? null,
      employee_id: input.employeeId,
      school_id: input.schoolId,
      allocation_percent: 100,
      allocated_amount: input.totalAmount,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      notes: "Default allocation — no scheduled sessions",
    });
    return;
  }

  for (const [program, mins] of Object.entries(programMinutes)) {
    const pct = (mins / totalMinutes) * 100;
    await supabase.from("payroll_cost_allocations").insert({
      payroll_record_id: input.payrollRecordId ?? null,
      employee_id: input.employeeId,
      school_id: input.schoolId,
      program,
      allocation_percent: Math.round(pct * 100) / 100,
      allocated_amount: Math.round(input.totalAmount * (pct / 100) * 100) / 100,
      instructional_minutes: Math.round(mins),
      period_start: input.periodStart,
      period_end: input.periodEnd,
    });
  }
}
