/**
 * One plan, as the family's Schedule of Tuition Payments.
 *
 * The document a family holds has, until now, been the ONLY place their
 * arrangement existed — typed by hand, which is how three of them ended up with
 * arithmetic errors and sixteen more with cents that do not close. This reads
 * the plan and renders it, so the document becomes a view of the data rather
 * than the data itself.
 */

import { createAuthClient } from "@/lib/supabase/server-auth";

export interface ScheduleDocument {
  readonly planId: string;
  readonly student: string;
  readonly school: string;
  readonly schoolYear: string;
  readonly billingMode: "scheduled" | "monthly_open";
  readonly annualTuition: number | null;
  readonly proratedTuition: number | null;
  readonly prorationLabel: string | null;
  readonly billingBasis: number | null;
  readonly remainingDue: number | null;
  readonly forgivenessAmount: number;
  readonly forgivenessReason: string | null;
  readonly overpaymentCredit: number;
  readonly monthlyAmount: number | null;
  readonly instalments: {
    readonly label: string;
    readonly amount: number;
    readonly isPaid: boolean;
  }[];
  readonly instalmentTotal: number;
  /** Recomputed here, not trusted from the plan. */
  readonly remainingBalance: number;
  readonly sourceDocument: string | null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadScheduleDocument(
  planId: string
): Promise<ScheduleDocument | { error: string }> {
  const supabase = await createAuthClient();

  const { data: plan, error: planError } = await supabase
    .from("student_tuition_plans")
    .select(
      "id, student_id, school_year_id, billing_mode, annual_tuition, prorated_tuition, proration_label, billing_basis, remaining_due, forgiveness_amount, forgiveness_reason, overpayment_credit, monthly_amount, source_document, status"
    )
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    return { error: `Could not read that plan: ${planError?.message ?? "not found"}` };
  }

  const [studentResult, yearResult, instalmentResult] = await Promise.all([
    supabase
      .from("students")
      .select("first_name, last_name, school_id")
      .eq("id", plan.student_id)
      .single(),
    supabase.from("school_years").select("name, school_id").eq("id", plan.school_year_id).single(),
    supabase
      .from("student_tuition_instalments")
      .select("label, amount, is_paid, sequence")
      .eq("plan_id", planId)
      .order("sequence"),
  ]);

  if (studentResult.error) return { error: `Could not read the student: ${studentResult.error.message}` };
  // Instalments missing would render a schedule with no payments on it, which a
  // family would read as "nothing to pay". Refuse instead.
  if (instalmentResult.error) {
    return { error: `Could not read the payments: ${instalmentResult.error.message}` };
  }

  let schoolName = "The Academy";
  const schoolId = studentResult.data?.school_id ?? yearResult.data?.school_id;
  if (schoolId) {
    const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).single();
    if (school?.name) schoolName = school.name as string;
  }

  const instalments = (instalmentResult.data ?? []).map((i) => ({
    label: i.label as string,
    amount: num(i.amount) ?? 0,
    isPaid: Boolean(i.is_paid),
  }));

  const instalmentTotal =
    Math.round(instalments.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;

  const remainingDue = num(plan.remaining_due);
  const forgiveness = num(plan.forgiveness_amount) ?? 0;
  const credit = num(plan.overpayment_credit) ?? 0;

  /**
   * Recomputed, never copied.
   *
   * Every hand-built schedule in the folder printed "Remaining Balance: $0.00"
   * as a claim. Three of them were wrong by thousands and sixteen by cents. A
   * document that states a balance it did not calculate is a document that can
   * lie without anybody noticing.
   */
  const remainingBalance =
    remainingDue === null
      ? 0
      : Math.round((remainingDue - forgiveness + credit - instalmentTotal) * 100) / 100;

  return {
    planId: plan.id as string,
    student:
      `${studentResult.data?.first_name ?? ""} ${studentResult.data?.last_name ?? ""}`.trim() ||
      "(unnamed student)",
    school: schoolName,
    schoolYear: (yearResult.data?.name as string) ?? "",
    billingMode: (plan.billing_mode as "scheduled" | "monthly_open") ?? "scheduled",
    annualTuition: num(plan.annual_tuition),
    proratedTuition: num(plan.prorated_tuition),
    prorationLabel: (plan.proration_label as string | null) ?? null,
    billingBasis: num(plan.billing_basis),
    remainingDue,
    forgivenessAmount: forgiveness,
    forgivenessReason: (plan.forgiveness_reason as string | null) ?? null,
    overpaymentCredit: credit,
    monthlyAmount: num(plan.monthly_amount),
    instalments,
    instalmentTotal,
    remainingBalance,
    sourceDocument: (plan.source_document as string | null) ?? null,
  };
}
