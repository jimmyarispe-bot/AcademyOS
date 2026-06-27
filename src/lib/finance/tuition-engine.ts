import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface TuitionCalculationInput {
  billingAccountId: string;
  studentId: string | null;
  subtotal: number;
  scholarshipCredit?: number;
  stateFundingCredit?: number;
  grantCredit?: number;
  discountAmount?: number;
  taxRatePercent?: number;
  lateFee?: number;
}

export interface TuitionCalculationResult {
  subtotal: number;
  siblingDiscount: number;
  scholarshipCredit: number;
  stateFundingCredit: number;
  grantCredit: number;
  discountAmount: number;
  taxAmount: number;
  lateFee: number;
  totalAmount: number;
  familyResponsibility: number;
}

export async function calculateTuitionInvoice(
  supabase: AuthClient,
  input: TuitionCalculationInput
): Promise<TuitionCalculationResult> {
  const { data } = await supabase.rpc("calculate_tuition_invoice_totals", {
    p_billing_account_id: input.billingAccountId,
    p_student_id: input.studentId,
    p_subtotal: input.subtotal,
    p_scholarship_credit: input.scholarshipCredit ?? 0,
    p_state_funding_credit: input.stateFundingCredit ?? 0,
    p_grant_credit: input.grantCredit ?? 0,
    p_discount_amount: input.discountAmount ?? 0,
    p_tax_rate_percent: input.taxRatePercent ?? 0,
    p_late_fee: input.lateFee ?? 0,
  });

  const row = Array.isArray(data) ? data[0] : data;
  const siblingDiscount = Number((row as { sibling_discount?: number })?.sibling_discount ?? 0);
  const taxAmount = Number((row as { tax_amount?: number })?.tax_amount ?? 0);
  const totalAmount = Number((row as { total_amount?: number })?.total_amount ?? 0);
  const familyResponsibility = Number((row as { family_responsibility?: number })?.family_responsibility ?? 0);

  return {
    subtotal: input.subtotal,
    siblingDiscount,
    scholarshipCredit: input.scholarshipCredit ?? 0,
    stateFundingCredit: input.stateFundingCredit ?? 0,
    grantCredit: input.grantCredit ?? 0,
    discountAmount: input.discountAmount ?? 0,
    taxAmount,
    lateFee: input.lateFee ?? 0,
    totalAmount,
    familyResponsibility,
  };
}

/** Resolve scholarship and state funding credits for a student from existing modules */
export async function resolveFundingCreditsForStudent(
  supabase: AuthClient,
  studentId: string,
  invoiceSubtotal: number
) {
  let scholarshipCredit = 0;
  let stateFundingCredit = 0;

  const { data: scholarships } = await supabase
    .from("scholarship_applications")
    .select("approved_amount, remaining_award_balance, scholarship_status")
    .eq("student_id", studentId)
    .eq("scholarship_status", "approved");

  for (const s of scholarships ?? []) {
    const available = Number(s.remaining_award_balance ?? s.approved_amount ?? 0);
    scholarshipCredit += Math.min(available, invoiceSubtotal - scholarshipCredit);
  }

  const { data: ssisFunding } = await supabase
    .from("ssis_student_funding_records")
    .select("award_amount, payment_status, verification_status")
    .eq("student_id", studentId)
    .eq("verification_status", "verified")
    .in("payment_status", ["expected", "partial", "unknown"]);

  for (const f of ssisFunding ?? []) {
    const available = Number(f.award_amount ?? 0) * (f.payment_status === "partial" ? 0.5 : 1);
    if (available > 0) {
      stateFundingCredit += Math.min(available, invoiceSubtotal - scholarshipCredit - stateFundingCredit);
    }
  }

  return { scholarshipCredit, stateFundingCredit };
}

export async function generateTuitionInvoiceFromPlan(
  supabase: AuthClient,
  input: {
    billingAccountId: string;
    studentId: string;
    tuitionPlanId: string;
    invoiceNumber: string;
    dueDate: string;
    description?: string;
  }
) {
  const { data: plan } = await supabase
    .from("tuition_plans")
    .select("*")
    .eq("id", input.tuitionPlanId)
    .single();

  if (!plan) throw new Error("Tuition plan not found");

  const subtotal = Number(plan.annual_amount) / (
    plan.billing_frequency === "monthly" ? 12 :
    plan.billing_frequency === "weekly" ? 52 :
    plan.billing_frequency === "daily" ? 180 :
    plan.billing_frequency === "hourly" ? 1 :
    plan.payment_schedule === "quarterly" ? 4 :
    plan.payment_schedule === "semester" ? 2 : 1
  );

  const credits = await resolveFundingCreditsForStudent(supabase, input.studentId, subtotal);
  const calc = await calculateTuitionInvoice(supabase, {
    billingAccountId: input.billingAccountId,
    studentId: input.studentId,
    subtotal,
    scholarshipCredit: credits.scholarshipCredit,
    stateFundingCredit: credits.stateFundingCredit,
    taxRatePercent: Number(plan.tax_rate_percent ?? 0),
  });

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      billing_account_id: input.billingAccountId,
      tuition_plan_id: input.tuitionPlanId,
      student_id: input.studentId,
      invoice_number: input.invoiceNumber,
      description: input.description ?? plan.name,
      subtotal: calc.subtotal,
      sibling_discount_amount: calc.siblingDiscount,
      scholarship_credit: calc.scholarshipCredit,
      state_funding_credit: calc.stateFundingCredit,
      grant_credit: calc.grantCredit,
      discount_amount: calc.discountAmount,
      tax_amount: calc.taxAmount,
      total_amount: calc.totalAmount,
      family_responsibility: calc.familyResponsibility,
      due_date: input.dueDate,
      invoice_status: "sent",
      issued_at: new Date().toISOString().split("T")[0],
      program: plan.program,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const lineItems = [
    { invoice_id: invoice.id, line_type: "tuition", description: plan.name, amount: calc.subtotal, student_id: input.studentId },
  ];
  if (calc.siblingDiscount > 0) {
    lineItems.push({ invoice_id: invoice.id, line_type: "discount", description: "Sibling discount", amount: -calc.siblingDiscount, student_id: input.studentId });
  }
  if (calc.scholarshipCredit > 0) {
    lineItems.push({ invoice_id: invoice.id, line_type: "scholarship", description: "Scholarship credit", amount: -calc.scholarshipCredit, student_id: input.studentId });
  }
  if (calc.stateFundingCredit > 0) {
    lineItems.push({ invoice_id: invoice.id, line_type: "state_funding", description: "State funding credit", amount: -calc.stateFundingCredit, student_id: input.studentId });
  }
  if (calc.taxAmount > 0) {
    lineItems.push({ invoice_id: invoice.id, line_type: "tax", description: "Tax", amount: calc.taxAmount, student_id: input.studentId });
  }
  await supabase.from("invoice_line_items").insert(lineItems);

  await supabase.rpc("sync_billing_account_balance", { p_account_id: input.billingAccountId });

  return { invoiceId: invoice.id, calculation: calc };
}
