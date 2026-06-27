import type { createAuthClient } from "@/lib/supabase/server-auth";
import type {
  ClassProfitabilityRow,
  TeacherProfitabilityRow,
  ProgramProfitabilityRow,
  StudentEconomicsRow,
  FamilyAnalyticsRow,
} from "@/lib/financial-intelligence/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export function buildCsvExport(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col];
          const str = val == null ? "" : String(val);
          return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function classProfitabilityToRows(rows: ClassProfitabilityRow[]) {
  return rows.map((r) => ({
    section_code: r.sectionCode,
    section_name: r.sectionName ?? "",
    revenue: r.revenue,
    total_cost: r.totalCost,
    net_margin: r.netMargin,
    margin_pct: r.marginPct.toFixed(2),
    break_even_enrollment: r.breakEvenEnrollment,
    current_enrollment: r.currentEnrollment,
    revenue_per_seat: r.revenuePerSeat.toFixed(2),
    profit_per_hour: r.profitPerHour.toFixed(2),
    health: r.healthIndicator,
  }));
}

export function teacherProfitabilityToRows(rows: TeacherProfitabilityRow[]) {
  return rows.map((r) => ({
    employee_name: r.employeeName ?? r.employeeId,
    revenue_generated: r.revenueGenerated,
    classes_taught: r.classesTaught,
    students_served: r.studentsServed,
    instructional_hours: r.instructionalHours.toFixed(1),
    payroll: r.payroll,
    net_margin: r.netMargin,
    revenue_per_hour: r.revenuePerHour.toFixed(2),
    cost_per_hour: r.costPerHour.toFixed(2),
    health: r.healthIndicator,
  }));
}

export function programProfitabilityToRows(rows: ProgramProfitabilityRow[]) {
  return rows.map((r) => ({
    program: r.program,
    revenue: r.revenue,
    expenses: r.expenses,
    payroll: r.payroll,
    scholarships: r.scholarships,
    state_funding: r.stateFunding,
    net_margin: r.netMargin,
    ebitda_contribution: r.ebitdaContribution,
    health: r.healthIndicator,
  }));
}

export function studentEconomicsToRows(rows: StudentEconomicsRow[]) {
  return rows.map((r) => ({
    student_name: r.studentName ?? r.studentId,
    tuition: r.tuition,
    scholarships: r.scholarships,
    esa: r.esa,
    state_funding: r.stateFunding,
    total_revenue: r.totalRevenue,
    allocated_costs: r.allocatedCosts,
    profitability: r.profitability,
    lifetime_value: r.lifetimeValue,
    health: r.healthIndicator,
  }));
}

export function familyAnalyticsToRows(rows: FamilyAnalyticsRow[]) {
  return rows.map((r) => ({
    family_id: r.familyId,
    lifetime_revenue: r.lifetimeRevenue,
    outstanding_balance: r.outstandingBalance,
    aid_received: r.aidReceived,
    payment_reliability: r.paymentReliability,
    avg_monthly_revenue: r.avgMonthlyRevenue.toFixed(2),
    collection_risk: r.collectionRisk,
  }));
}

export async function getStoredReportView(
  supabase: AuthClient,
  view: "class" | "program" | "school",
  schoolId?: string
) {
  const table =
    view === "class"
      ? "rpt_fi_class_profitability"
      : view === "program"
        ? "rpt_fi_program_profitability"
        : "rpt_fi_school_summary";

  let query = supabase.from(table).select("*");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}
