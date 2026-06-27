import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ClassProfitabilityRow, TeacherProfitabilityRow, ProgramProfitabilityRow, StudentEconomicsRow } from "@/lib/financial-intelligence/types";
import { healthFromMargin } from "@/lib/financial-intelligence/types";
import { getAllocationRates, allocateCosts, estimatePayrollCosts } from "@/lib/financial-intelligence/cost-allocation";
import { getSectionRevenue, getProgramRevenue, getStudentRevenue } from "@/lib/financial-intelligence/revenue-allocation";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function periodBounds(periodType: "monthly" | "quarterly" | "annual" = "monthly") {
  const now = new Date();
  let start: Date;
  if (periodType === "annual") {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (periodType === "quarterly") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), q, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const end = new Date();
  return { periodStart: start.toISOString().split("T")[0], periodEnd: end.toISOString().split("T")[0] };
}

export async function computeClassProfitability(
  supabase: AuthClient,
  schoolId: string,
  periodType: "monthly" | "quarterly" | "annual" = "monthly"
): Promise<ClassProfitabilityRow[]> {
  const { periodStart, periodEnd } = periodBounds(periodType);
  const rates = await getAllocationRates(supabase, schoolId);

  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, section_code, max_capacity, instructional_minutes, instructor_employee_id, courses(name, school_id)")
    .eq("status", "open");

  const filtered = (sections ?? []).filter((s) => {
    const c = Array.isArray(s.courses) ? s.courses[0] : s.courses;
    return (c as { school_id?: string })?.school_id === schoolId;
  });

  const rows: ClassProfitabilityRow[] = [];

  for (const section of filtered) {
    const rev = await getSectionRevenue(supabase, section.id, periodStart, periodEnd);
    const enrollment = rev.enrollment;
    const capacity = section.max_capacity ?? 30;

    let teacherPay = 0;
    let benefits = 0;
    let payrollTaxes = 0;
    if (section.instructor_employee_id) {
      const { data: payroll } = await supabase
        .from("payroll_cost_allocations")
        .select("allocated_amount")
        .eq("employee_id", section.instructor_employee_id)
        .gte("period_start", periodStart)
        .lte("period_end", periodEnd)
        .limit(1);
      const gross = Number(payroll?.[0]?.allocated_amount ?? rev.enrollment * 500);
      const est = estimatePayrollCosts(gross);
      teacherPay = est.grossPay;
      benefits = est.benefits;
      payrollTaxes = est.payrollTaxes;
    }

    const { data: sessions } = await supabase
      .from("instructional_sessions")
      .select("scheduled_start, scheduled_end")
      .eq("course_section_id", section.id)
      .gte("scheduled_start", `${periodStart}T00:00:00`)
      .lte("scheduled_start", `${periodEnd}T23:59:59`);

    const instructionalHours = (sessions ?? []).reduce((s, sess) => {
      return s + (new Date(sess.scheduled_end).getTime() - new Date(sess.scheduled_start).getTime()) / 3600000;
    }, 0) || (enrollment * (section.instructional_minutes ?? 60) / 60);

    const directCosts = teacherPay + benefits + payrollTaxes;
    const allocated = allocateCosts(rev.revenue, directCosts, instructionalHours, enrollment, rates);
    const grossMargin = rev.revenue - directCosts;
    const netMargin = rev.revenue - allocated.totalCost;
    const marginPct = rev.revenue ? (netMargin / rev.revenue) * 100 : 0;
    const contributionMargin = rev.revenue - directCosts - allocated.sharedCosts * 0.5;
    const revenuePerSeat = enrollment ? rev.revenue / enrollment : 0;
    const costPerSeat = enrollment ? allocated.totalCost / enrollment : 0;
    const breakEvenEnrollment = revenuePerSeat > costPerSeat && costPerSeat > 0
      ? Math.ceil(allocated.totalCost / Math.max(revenuePerSeat, 1))
      : capacity;

    const course = Array.isArray(section.courses) ? section.courses[0] : section.courses;

    rows.push({
      courseSectionId: section.id,
      sectionCode: section.section_code,
      sectionName: (course as { name?: string })?.name,
      revenue: rev.revenue,
      teacherPay,
      benefitsAllocation: benefits,
      payrollTaxes,
      technologyCost: allocated.technologyCost,
      curriculumCost: allocated.curriculumCost,
      facilityCost: allocated.facilityCost,
      adminOverhead: allocated.adminOverhead,
      marketingAllocation: allocated.marketingAllocation,
      insuranceAllocation: allocated.insuranceAllocation,
      utilitiesAllocation: allocated.utilitiesAllocation,
      occupancyAllocation: allocated.occupancyAllocation,
      sharedCosts: allocated.sharedCosts,
      totalCost: allocated.totalCost,
      grossMargin,
      netMargin,
      contributionMargin,
      marginPct,
      breakEvenEnrollment,
      currentEnrollment: enrollment,
      availableSeats: Math.max(capacity - enrollment, 0),
      revenuePerSeat,
      profitPerSeat: enrollment ? netMargin / enrollment : 0,
      revenuePerHour: instructionalHours ? rev.revenue / instructionalHours : 0,
      costPerHour: instructionalHours ? allocated.totalCost / instructionalHours : 0,
      profitPerHour: instructionalHours ? netMargin / instructionalHours : 0,
      healthIndicator: healthFromMargin(marginPct, enrollment - breakEvenEnrollment),
    });

    await supabase.from("fi_profitability_snapshots").upsert(
      {
        school_id: schoolId,
        entity_type: "class",
        entity_id: section.id,
        entity_key: section.section_code,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        revenue: rev.revenue,
        total_cost: allocated.totalCost,
        gross_margin: grossMargin,
        net_margin: netMargin,
        contribution_margin: contributionMargin,
        margin_pct: marginPct,
        health_indicator: healthFromMargin(marginPct, enrollment - breakEvenEnrollment),
        enrollment_count: enrollment,
        capacity,
        instructional_hours: instructionalHours,
        revenue_per_seat: revenuePerSeat,
        cost_per_seat: costPerSeat,
        profit_per_seat: enrollment ? netMargin / enrollment : 0,
        revenue_per_hour: instructionalHours ? rev.revenue / instructionalHours : 0,
        cost_per_hour: instructionalHours ? allocated.totalCost / instructionalHours : 0,
        profit_per_hour: instructionalHours ? netMargin / instructionalHours : 0,
        break_even_enrollment: breakEvenEnrollment,
        metrics: { teacher_pay: teacherPay, benefits, payroll_taxes: payrollTaxes, ...allocated },
      },
      { onConflict: "school_id,entity_type,entity_id,entity_key,period_type,period_start" }
    );
  }

  return rows.sort((a, b) => b.netMargin - a.netMargin);
}

export async function computeTeacherProfitability(
  supabase: AuthClient,
  schoolId: string
): Promise<TeacherProfitabilityRow[]> {
  const { periodStart, periodEnd } = periodBounds("monthly");
  const rates = await getAllocationRates(supabase, schoolId);

  const { data: employees } = await supabase
    .from("employees")
    .select("id, user_id, users(full_name)")
    .eq("school_id", schoolId)
    .eq("employment_status", "active");

  const rows: TeacherProfitabilityRow[] = [];

  for (const emp of employees ?? []) {
    const { data: sections } = await supabase
      .from("course_sections")
      .select("id, max_capacity")
      .eq("instructor_employee_id", emp.id)
      .eq("status", "open");

    let revenueGenerated = 0;
    let studentsServed = 0;
    for (const sec of sections ?? []) {
      const rev = await getSectionRevenue(supabase, sec.id, periodStart, periodEnd);
      revenueGenerated += rev.revenue;
      studentsServed += rev.enrollment;
    }

    const { data: payroll } = await supabase
      .from("payroll_cost_allocations")
      .select("allocated_amount")
      .eq("employee_id", emp.id)
      .gte("period_start", periodStart)
      .lte("period_end", periodEnd);

    const gross = (payroll ?? []).reduce((s, p) => s + Number(p.allocated_amount), 0) || 5000;
    const { grossPay, benefits, payrollTaxes, total } = estimatePayrollCosts(gross);
    const allocatedOverhead = revenueGenerated * (rates.adminOverheadPct + rates.technologyPct);
    const totalCost = total + allocatedOverhead;

    const { data: sessions } = await supabase
      .from("instructional_sessions")
      .select("scheduled_start, scheduled_end")
      .eq("instructor_employee_id", emp.id)
      .gte("scheduled_start", `${periodStart}T00:00:00`);

    const instructionalHours = (sessions ?? []).reduce(
      (s, sess) => s + (new Date(sess.scheduled_end).getTime() - new Date(sess.scheduled_start).getTime()) / 3600000,
      0
    );

    const netMargin = revenueGenerated - totalCost;
    const marginPct = revenueGenerated ? (netMargin / revenueGenerated) * 100 : 0;
    const user = Array.isArray(emp.users) ? emp.users[0] : emp.users;

    rows.push({
      employeeId: emp.id,
      employeeName: (user as { full_name?: string })?.full_name,
      revenueGenerated,
      classesTaught: sections?.length ?? 0,
      studentsServed,
      instructionalHours,
      payroll: grossPay,
      benefits,
      payrollTaxes,
      allocatedOverhead,
      revenuePerHour: instructionalHours ? revenueGenerated / instructionalHours : 0,
      costPerHour: instructionalHours ? totalCost / instructionalHours : 0,
      grossMargin: revenueGenerated - total,
      netMargin,
      healthIndicator: healthFromMargin(marginPct),
    });
  }

  return rows.sort((a, b) => b.netMargin - a.netMargin);
}

export async function computeProgramProfitability(
  supabase: AuthClient,
  schoolId: string
): Promise<ProgramProfitabilityRow[]> {
  const { periodStart, periodEnd } = periodBounds("quarterly");
  const rates = await getAllocationRates(supabase, schoolId);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("program, total_amount, family_billing_accounts!inner(school_id)")
    .eq("family_billing_accounts.school_id", schoolId)
    .not("invoice_status", "eq", "void");

  const programs = [...new Set((invoices ?? []).map((i) => i.program ?? "General"))];
  const rows: ProgramProfitabilityRow[] = [];

  for (const program of programs) {
    const rev = await getProgramRevenue(supabase, schoolId, program, periodStart, periodEnd);
    const { data: allocations } = await supabase
      .from("payroll_cost_allocations")
      .select("allocated_amount")
      .eq("school_id", schoolId)
      .eq("program", program)
      .gte("period_start", periodStart);

    const payroll = (allocations ?? []).reduce((s, a) => s + Number(a.allocated_amount), 0);
    const administration = rev.revenue * rates.adminOverheadPct;
    const technology = rev.revenue * rates.technologyPct;
    const occupancy = rev.revenue * rates.occupancyPct;
    const expenses = payroll + rev.scholarships + administration + technology + occupancy;
    const netMargin = rev.revenue - expenses;
    const marginPct = rev.revenue ? (netMargin / rev.revenue) * 100 : 0;

    rows.push({
      program,
      revenue: rev.revenue,
      expenses,
      payroll,
      scholarships: rev.scholarships,
      stateFunding: rev.stateFunding,
      grants: rev.grants,
      occupancy,
      technology,
      administration,
      netMargin,
      ebitdaContribution: netMargin * 0.85,
      enrollmentTrend: null,
      healthIndicator: healthFromMargin(marginPct),
    });

    await supabase.from("fi_profitability_snapshots").upsert(
      {
        school_id: schoolId,
        entity_type: "program",
        entity_id: null,
        entity_key: program,
        period_type: "quarterly",
        period_start: periodStart,
        period_end: periodEnd,
        revenue: rev.revenue,
        total_cost: expenses,
        net_margin: netMargin,
        ebitda_contribution: netMargin * 0.85,
        margin_pct: marginPct,
        health_indicator: healthFromMargin(marginPct),
        metrics: { payroll, scholarships: rev.scholarships, state_funding: rev.stateFunding },
      },
      { onConflict: "school_id,entity_type,entity_id,entity_key,period_type,period_start" }
    );
  }

  return rows.sort((a, b) => b.netMargin - a.netMargin);
}

export async function computeStudentEconomics(
  supabase: AuthClient,
  schoolId: string,
  limit = 50
): Promise<StudentEconomicsRow[]> {
  const rates = await getAllocationRates(supabase, schoolId);
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("school_id", schoolId)
    .eq("lifecycle_stage", "active")
    .limit(limit);

  const rows: StudentEconomicsRow[] = [];

  for (const st of students ?? []) {
    const rev = await getStudentRevenue(supabase, st.id);
    const allocatedCosts = rev.totalRevenue * (rates.adminOverheadPct + rates.technologyPct + 0.15);
    const profitability = rev.totalRevenue - allocatedCosts;
    const marginPct = rev.totalRevenue ? (profitability / rev.totalRevenue) * 100 : 0;

    rows.push({
      studentId: st.id,
      studentName: `${st.first_name} ${st.last_name}`,
      tuition: rev.tuition,
      scholarships: rev.scholarships,
      esa: rev.esa,
      stateFunding: rev.stateFunding,
      grants: rev.grants,
      additionalServices: 0,
      totalRevenue: rev.totalRevenue,
      allocatedCosts,
      profitability,
      lifetimeValue: rev.totalRevenue * 4,
      healthIndicator: healthFromMargin(marginPct),
    });
  }

  return rows.sort((a, b) => b.profitability - a.profitability);
}

export async function getStoredClassProfitability(supabase: AuthClient, schoolId: string) {
  const { data } = await supabase
    .from("rpt_fi_class_profitability")
    .select("*")
    .eq("school_id", schoolId)
    .order("net_margin", { ascending: false });
  return data ?? [];
}
