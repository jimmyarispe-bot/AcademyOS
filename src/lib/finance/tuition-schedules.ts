/**
 * Reading every family's 2026-27 tuition arrangement.
 *
 * Until September 2026 these arrangements existed only as hand-built PDFs in a
 * OneDrive folder, which is why three of them contained arithmetic errors
 * nobody caught and why sixteen more were out by a few cents. Migrations 270,
 * 279 and 281 moved them into `student_tuition_plans`; this is the first thing
 * that reads them.
 *
 * Four separate reads rather than one nested select. These tables are tens of
 * rows, and four things that can each fail with their own message beat one
 * thing that fails with none.
 *
 * THE MOST IMPORTANT ROWS ON THIS SCREEN ARE THE ONES WITH NO PLAN. A student
 * enrolled with no tuition arrangement is invisible in every other view — they
 * simply do not appear — and that is exactly how a child attends for a year
 * without an invoice. So active students are read too, and the ones without a
 * plan are listed by name.
 */

import { createAuthClient } from "@/lib/supabase/server-auth";
import {
  channelUnknown,
  isOffSquare,
  type BillingMode,
  type InstalmentRow,
  type PlanRow,
  type SchedulesView,
  type SchoolSchedules,
  type UnplannedStudent,
} from "@/lib/finance/tuition-schedules-shared";

export type {
  BillingMode,
  InstalmentRow,
  PlanRow,
  SchedulesView,
  SchoolSchedules,
  UnplannedStudent,
} from "@/lib/finance/tuition-schedules-shared";

function num(v: unknown): number {
  // numeric(12,2) arrives from PostgREST as a string. Number("") is 0, which is
  // the one wrong answer, so empty is treated as absent rather than as zero.
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function listTuitionSchedules(): Promise<SchedulesView | { error: string }> {
  const supabase = await createAuthClient();

  const [balancesResult, plansResult, instalmentsResult, studentsResult, schoolsResult] =
    await Promise.all([
      supabase
        .from("student_tuition_plan_balances")
        // ONE string literal, not a concatenation. supabase-js parses the
        // select at the type level, and `"a" + "b"` is not a literal it can
        // read — every column then comes back as GenericStringError and the
        // whole file stops compiling. Long line, deliberately.
        .select(
          "plan_id, student_id, student, school, school_year, billing_mode, payment_channel, monthly_amount, billing_basis, remaining_due, forgiveness_amount, overpayment_credit, scheduled_total, unaccounted, closes, instalment_count, paid_to_date"
        ),
      supabase
        .from("student_tuition_plans")
        .select("id, source_document, notes")
        .eq("status", "active"),
      supabase
        .from("student_tuition_instalments")
        .select("id, plan_id, sequence, label, due_date, amount, is_paid, paid_at"),
      supabase
        // No embedded `schools(name)`. The auth client is untyped, so an embed
        // that PostgREST cannot resolve fails at runtime rather than at build
        // time — and it would fail by returning students with no school, which
        // this screen would render as a real group. Two flat reads instead.
        .from("students")
        .select("id, first_name, last_name, grade_level, school_id")
        .eq("status", "active"),
      supabase.from("schools").select("id, name"),
    ]);

  // Every one of these can be refused by RLS, and a refusal returns no rows —
  // which on this screen looks exactly like "nobody owes anything". Say which
  // read failed rather than render a reassuring blank.
  if (balancesResult.error) {
    return { error: `Could not read tuition plans: ${balancesResult.error.message}` };
  }
  if (plansResult.error) {
    return { error: `Could not read plan documents: ${plansResult.error.message}` };
  }
  // A missing instalment does not just hide a row; it makes a plan look like it
  // fails to add up. Refuse the screen rather than accuse a correct plan.
  if (instalmentsResult.error) {
    return { error: `Could not read instalments: ${instalmentsResult.error.message}` };
  }
  // Without the student list the "enrolled, no plan" section would render empty
  // and read as "everyone is covered", which is the one conclusion that must
  // never be reached by accident.
  if (studentsResult.error) {
    return { error: `Could not read students: ${studentsResult.error.message}` };
  }
  if (schoolsResult.error) {
    return { error: `Could not read schools: ${schoolsResult.error.message}` };
  }

  const detailById = new Map(
    (plansResult.data ?? []).map((p) => [p.id as string, p])
  );

  const instalmentsByPlan = new Map<string, InstalmentRow[]>();
  for (const i of instalmentsResult.data ?? []) {
    const list = instalmentsByPlan.get(i.plan_id as string) ?? [];
    list.push({
      id: i.id as string,
      sequence: i.sequence as number,
      label: i.label as string,
      dueDate: (i.due_date as string | null) ?? null,
      amount: num(i.amount),
      isPaid: Boolean(i.is_paid),
      paidAt: (i.paid_at as string | null) ?? null,
    });
    instalmentsByPlan.set(i.plan_id as string, list);
  }
  for (const list of instalmentsByPlan.values()) {
    list.sort((a, b) => a.sequence - b.sequence);
  }

  const plans: PlanRow[] = [];
  const studentIdsWithPlan = new Set<string>();

  for (const b of balancesResult.data ?? []) {
    const planId = b.plan_id as string;
    const detail = detailById.get(planId);
    const mode = (b.billing_mode as BillingMode) ?? "scheduled";

    studentIdsWithPlan.add(b.student_id as string);
    plans.push({
      planId,
      studentId: b.student_id as string,
      student: (b.student as string) ?? "(unnamed student)",
      schoolName: (b.school as string) ?? "(no school)",
      schoolYear: (b.school_year as string) ?? "",
      billingMode: mode,
      paymentChannel: (b.payment_channel as string | null) ?? null,
      monthlyAmount: numOrNull(b.monthly_amount),
      // These stay null for a monthly plan. numOrNull, not num — a monthly plan
      // does not owe zero for the year, it has no year figure at all.
      remainingDue: numOrNull(b.remaining_due),
      billingBasis: numOrNull(b.billing_basis),
      scheduledTotal: numOrNull(b.scheduled_total),
      unaccounted: numOrNull(b.unaccounted),
      closes: b.closes === null || b.closes === undefined ? null : Boolean(b.closes),
      forgivenessAmount: num(b.forgiveness_amount),
      overpaymentCredit: num(b.overpayment_credit),
      paidToDate: num(b.paid_to_date),
      instalmentCount: Number(b.instalment_count ?? 0),
      sourceDocument: (detail?.source_document as string | null) ?? null,
      notes: (detail?.notes as string | null) ?? null,
      instalments: instalmentsByPlan.get(planId) ?? [],
    });
  }

  const schoolNameById = new Map(
    (schoolsResult.data ?? []).map((sc) => [sc.id as string, sc.name as string])
  );

  const unplanned: UnplannedStudent[] = [];
  for (const s of studentsResult.data ?? []) {
    if (studentIdsWithPlan.has(s.id as string)) continue;
    const schoolName = schoolNameById.get(s.school_id as string) ?? "(no school)";
    unplanned.push({
      studentId: s.id as string,
      student: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "(unnamed student)",
      schoolName,
      gradeLevel: (s.grade_level as string | null) ?? null,
    });
  }

  const schoolNames = new Set<string>([
    ...plans.map((p) => p.schoolName),
    ...unplanned.map((u) => u.schoolName),
  ]);

  const schools: SchoolSchedules[] = [...schoolNames]
    .map((schoolName) => {
      const mine = plans
        .filter((p) => p.schoolName === schoolName)
        .sort(
          (a, b) =>
            a.billingMode.localeCompare(b.billingMode) || a.student.localeCompare(b.student)
        );
      return {
        schoolName,
        plans: mine,
        unplanned: unplanned
          .filter((u) => u.schoolName === schoolName)
          .sort((a, b) => a.student.localeCompare(b.student)),
        monthlyCommitted: mine
          .filter((p) => p.billingMode === "monthly_open")
          .reduce((sum, p) => sum + (p.monthlyAmount ?? 0), 0),
        scheduledOwed: mine
          .filter((p) => p.billingMode === "scheduled")
          .reduce((sum, p) => sum + (p.remainingDue ?? 0), 0),
        notClosing: mine.filter((p) => p.closes === false).length,
        offSquare: mine.filter((p) => isOffSquare(p.paymentChannel)).length,
        noChannel: mine.filter((p) => channelUnknown(p.paymentChannel)).length,
      };
    })
    .sort((a, b) => a.schoolName.localeCompare(b.schoolName));

  return {
    schools,
    totalPlans: plans.length,
    totalUnplanned: unplanned.length,
    totalNotClosing: plans.filter((p) => p.closes === false).length,
  };
}
