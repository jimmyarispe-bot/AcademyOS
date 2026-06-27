"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { writePlatformAudit } from "@/lib/platform/automation/audit";
import { generateTuitionInvoiceFromPlan } from "@/lib/finance/tuition-engine";
import { recordFinancialTransaction } from "@/lib/finance/ledger";
import { enqueueBillingReminder } from "@/lib/finance/automation";
import { buildBudgetForecastSnapshot } from "@/lib/finance/forecasting";

export async function createBillingAccount(formData: FormData) {
  const supabase = await createAuthClient();

  const { error } = await supabase.from("family_billing_accounts").insert({
    family_id: formData.get("family_id") as string,
    school_id: formData.get("school_id") as string,
    sibling_discount_student_id: (formData.get("sibling_discount_student_id") as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function createInvoice(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  const subtotal = Number(formData.get("subtotal")) || 0;
  const billingAccountId = formData.get("billing_account_id") as string;
  const studentId = (formData.get("student_id") as string) || null;
  const scholarshipCredit = Number(formData.get("scholarship_credit") || 0);
  const stateFundingCredit = Number(formData.get("state_funding_credit") || 0);

  const { data: totals } = await supabase.rpc("calculate_tuition_invoice_totals", {
    p_billing_account_id: billingAccountId,
    p_student_id: studentId,
    p_subtotal: subtotal,
    p_scholarship_credit: scholarshipCredit,
    p_state_funding_credit: stateFundingCredit,
    p_grant_credit: 0,
    p_discount_amount: 0,
    p_tax_rate_percent: 0,
    p_late_fee: 0,
  });

  const row = Array.isArray(totals) ? totals[0] : totals;
  const siblingDiscount = Number((row as { sibling_discount?: number })?.sibling_discount ?? 0);
  const totalAmount = Number((row as { total_amount?: number })?.total_amount ?? subtotal - siblingDiscount);
  const familyResponsibility = Number((row as { family_responsibility?: number })?.family_responsibility ?? totalAmount);

  const { data: account } = await supabase
    .from("family_billing_accounts")
    .select("school_id, family_id")
    .eq("id", billingAccountId)
    .single();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      billing_account_id: billingAccountId,
      tuition_plan_id: (formData.get("tuition_plan_id") as string) || null,
      student_id: studentId,
      invoice_number: formData.get("invoice_number") as string,
      description: (formData.get("description") as string) || null,
      subtotal,
      sibling_discount_amount: siblingDiscount,
      scholarship_credit: scholarshipCredit,
      state_funding_credit: stateFundingCredit,
      total_amount: totalAmount,
      family_responsibility: familyResponsibility,
      due_date: formData.get("due_date") as string,
      invoice_status: "sent",
      issued_at: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (account) {
    await recordFinancialTransaction(supabase, {
      schoolId: account.school_id,
      sourceModule: "finance",
      transactionType: "invoice",
      category: "tuition_billed",
      amount: totalAmount,
      studentId,
      familyId: account.family_id,
      invoiceId: invoice.id,
      description: formData.get("description") as string,
      createdBy: user?.id ?? null,
    });

    await supabase.rpc("sync_billing_account_balance", { p_account_id: billingAccountId });
    await enqueueBillingReminder(supabase, {
      schoolId: account.school_id,
      familyId: account.family_id,
      invoiceId: invoice.id,
      dueDate: formData.get("due_date") as string,
    });
  }

  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function createTuitionInvoiceFromPlanAction(formData: FormData) {
  const supabase = await createAuthClient();
  try {
    await generateTuitionInvoiceFromPlan(supabase, {
      billingAccountId: formData.get("billing_account_id") as string,
      studentId: formData.get("student_id") as string,
      tuitionPlanId: formData.get("tuition_plan_id") as string,
      invoiceNumber: formData.get("invoice_number") as string,
      dueDate: formData.get("due_date") as string,
      description: (formData.get("description") as string) || undefined,
    });
    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to generate invoice" };
  }
}

export async function recordPayment(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  const invoiceId = formData.get("invoice_id") as string;
  const amount = Number(formData.get("amount"));

  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("*, family_billing_accounts(school_id, family_id)")
    .eq("id", invoiceId)
    .single();

  const receiptNumber = `RCP-${Date.now()}`;

  const { data: payment, error: payError } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      amount,
      payment_method: (formData.get("payment_method") as string) || "other",
      reference_number: (formData.get("reference_number") as string) || null,
      recorded_by_user_id: user?.id ?? null,
      notes: (formData.get("notes") as string) || null,
      payment_status: "completed",
      receipt_number: receiptNumber,
      external_processor_ref: (formData.get("external_processor_ref") as string) || null,
    })
    .select("id")
    .single();

  if (payError) return { error: payError.message };

  if (invoiceRow) {
    const newPaid = Number(invoiceRow.amount_paid) + amount;
    const total = Number(invoiceRow.total_amount);
    const status = newPaid >= total ? "paid" : "partial";

    await supabase
      .from("invoices")
      .update({
        amount_paid: newPaid,
        invoice_status: status,
        paid_at: status === "paid" ? new Date().toISOString().split("T")[0] : null,
      })
      .eq("id", invoiceId);

    const acct = Array.isArray(invoiceRow.family_billing_accounts)
      ? invoiceRow.family_billing_accounts[0]
      : invoiceRow.family_billing_accounts;

    if (acct) {
      await recordFinancialTransaction(supabase, {
        schoolId: (acct as { school_id: string }).school_id,
        sourceModule: "finance",
        transactionType: "payment",
        category: "tuition_collected",
        amount,
        studentId: invoiceRow.student_id,
        familyId: (acct as { family_id: string }).family_id,
        invoiceId,
        paymentId: payment?.id,
        description: `Payment ${receiptNumber}`,
        createdBy: user?.id ?? null,
      });

      await supabase.rpc("sync_billing_account_balance", {
        p_account_id: invoiceRow.billing_account_id,
      });
    }
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/apply/portal/finance");
  return { success: true, receiptNumber };
}

export async function createTuitionPlan(formData: FormData) {
  const supabase = await createAuthClient();

  const { error } = await supabase.from("tuition_plans").insert({
    school_id: formData.get("school_id") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    program: (formData.get("program") as string) || null,
    annual_amount: Number(formData.get("annual_amount")),
    payment_schedule: (formData.get("payment_schedule") as string) || "monthly",
    billing_frequency: (formData.get("billing_frequency") as string) || "monthly",
    service_type: (formData.get("service_type") as string) || "tuition",
    hourly_rate: formData.get("hourly_rate") ? Number(formData.get("hourly_rate")) : null,
    tax_rate_percent: Number(formData.get("tax_rate_percent") || 0),
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function addBillingPayerAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("family_billing_payers").insert({
    billing_account_id: formData.get("billing_account_id") as string,
    guardian_id: (formData.get("guardian_id") as string) || null,
    payer_name: formData.get("payer_name") as string,
    payer_email: (formData.get("payer_email") as string) || null,
    responsibility_percent: Number(formData.get("responsibility_percent") || 100),
    is_primary: formData.get("is_primary") === "true",
    custody_basis: (formData.get("custody_basis") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/finance/families/${formData.get("family_id")}`);
  return { success: true };
}

export async function addPaymentMethodAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("family_payment_methods").insert({
    billing_account_id: formData.get("billing_account_id") as string,
    guardian_id: (formData.get("guardian_id") as string) || null,
    method_type: formData.get("method_type") as string,
    last_four: (formData.get("last_four") as string) || null,
    is_default: formData.get("is_default") === "true",
    provider: "square_planned",
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/finance/families/${formData.get("family_id")}`);
  revalidatePath("/apply/portal/finance");
  return { success: true };
}

export async function createBillingCreditAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const amount = Number(formData.get("amount"));

  const { error } = await supabase.from("billing_credits").insert({
    billing_account_id: formData.get("billing_account_id") as string,
    student_id: (formData.get("student_id") as string) || null,
    amount,
    remaining_amount: amount,
    reason: (formData.get("reason") as string) || null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  await supabase.rpc("sync_billing_account_balance", {
    p_account_id: formData.get("billing_account_id") as string,
  });
  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function createBillingAdjustmentAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("billing_adjustments").insert({
    billing_account_id: formData.get("billing_account_id") as string,
    invoice_id: (formData.get("invoice_id") as string) || null,
    adjustment_type: formData.get("adjustment_type") as string,
    amount: Number(formData.get("amount")),
    reason: formData.get("reason") as string,
    created_by: user?.id ?? null,
    approval_status: "approved",
    approved_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function createPaymentPlanAction(formData: FormData) {
  const supabase = await createAuthClient();
  const billingAccountId = formData.get("billing_account_id") as string;

  const { data: plan, error } = await supabase
    .from("payment_plans")
    .insert({
      billing_account_id: billingAccountId,
      name: formData.get("name") as string,
      total_amount: Number(formData.get("total_amount")),
      installment_amount: Number(formData.get("installment_amount")),
      installment_count: Number(formData.get("installment_count")),
      frequency: (formData.get("frequency") as string) || "monthly",
      start_date: formData.get("start_date") as string,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("family_billing_accounts")
    .update({ payment_plan_id: plan.id, collections_status: "payment_plan" })
    .eq("id", billingAccountId);

  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function createScholarshipFundAction(formData: FormData) {
  const supabase = await createAuthClient();
  const total = Number(formData.get("total_allocation"));

  const { error } = await supabase.from("scholarship_funds").insert({
    school_id: formData.get("school_id") as string,
    fund_name: formData.get("fund_name") as string,
    fund_type: formData.get("fund_type") as string,
    donor_name: (formData.get("donor_name") as string) || null,
    total_allocation: total,
    remaining_balance: total,
    restrictions: (formData.get("restrictions") as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/scholarships");
  return { success: true };
}

export async function buildForecastAction(formData: FormData) {
  const supabase = await createAuthClient();
  await buildBudgetForecastSnapshot(supabase, formData.get("school_id") as string);
  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function applyLateFeeAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const invoiceId = formData.get("invoice_id") as string;
  const amount = Number(formData.get("amount"));
  const reason = (formData.get("reason") as string) || "Late fee";

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, family_billing_accounts(school_id, family_id)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return { error: "Invoice not found" };

  const newLateFee = Number(invoice.late_fee_amount ?? 0) + amount;
  const newTotal = Number(invoice.total_amount) + amount;

  await supabase
    .from("invoices")
    .update({
      late_fee_amount: newLateFee,
      total_amount: newTotal,
      family_responsibility: Number(invoice.family_responsibility ?? invoice.total_amount) + amount,
      invoice_status: invoice.invoice_status === "sent" ? "overdue" : invoice.invoice_status,
    })
    .eq("id", invoiceId);

  await supabase.from("billing_adjustments").insert({
    billing_account_id: invoice.billing_account_id,
    invoice_id: invoiceId,
    adjustment_type: "debit",
    amount,
    reason,
    created_by: user?.id ?? null,
    approval_status: "approved",
    approved_by: user?.id ?? null,
  });

  await supabase.rpc("sync_billing_account_balance", { p_account_id: invoice.billing_account_id });

  const acct = Array.isArray(invoice.family_billing_accounts)
    ? invoice.family_billing_accounts[0]
    : invoice.family_billing_accounts;

  if (acct) {
    await recordFinancialTransaction(supabase, {
      schoolId: (acct as { school_id: string }).school_id,
      sourceModule: "finance",
      transactionType: "adjustment",
      category: "late_fee",
      amount,
      familyId: (acct as { family_id: string }).family_id,
      studentId: invoice.student_id,
      invoiceId,
      description: reason,
      createdBy: user?.id ?? null,
    });
    await writePlatformAudit(supabase, {
      module: "finance",
      entityType: "invoice",
      entityId: invoiceId,
      actionType: "late_fee_applied",
      summary: `Late fee $${amount} applied`,
      actorUserId: user?.id,
      schoolId: (acct as { school_id: string }).school_id,
    });
  }

  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function applyWriteOffAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const invoiceId = formData.get("invoice_id") as string;
  const amount = Number(formData.get("amount"));
  const reason = formData.get("reason") as string;

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, family_billing_accounts(school_id, family_id)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return { error: "Invoice not found" };

  const balance = Number(invoice.total_amount) - Number(invoice.amount_paid);
  const writeOff = Math.min(amount, balance);
  const newTotal = Number(invoice.total_amount) - writeOff;
  const fullyWrittenOff = writeOff >= balance;

  await supabase
    .from("invoices")
    .update({
      total_amount: newTotal,
      family_responsibility: Math.max(0, Number(invoice.family_responsibility ?? invoice.total_amount) - writeOff),
      invoice_status: fullyWrittenOff ? "written_off" : invoice.invoice_status,
    })
    .eq("id", invoiceId);

  await supabase.from("billing_adjustments").insert({
    billing_account_id: invoice.billing_account_id,
    invoice_id: invoiceId,
    adjustment_type: "write_off",
    amount: writeOff,
    reason,
    created_by: user?.id ?? null,
    approval_status: "approved",
    approved_by: user?.id ?? null,
  });

  if (fullyWrittenOff) {
    await supabase
      .from("family_billing_accounts")
      .update({ collections_status: "written_off" })
      .eq("id", invoice.billing_account_id);
  }

  await supabase.rpc("sync_billing_account_balance", { p_account_id: invoice.billing_account_id });

  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function processRefundAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const billingAccountId = formData.get("billing_account_id") as string;
  const amount = Number(formData.get("amount"));
  const reason = formData.get("reason") as string;
  const invoiceId = (formData.get("invoice_id") as string) || null;

  await supabase.from("billing_adjustments").insert({
    billing_account_id: billingAccountId,
    invoice_id: invoiceId,
    adjustment_type: "refund",
    amount,
    reason,
    created_by: user?.id ?? null,
    approval_status: "approved",
    approved_by: user?.id ?? null,
  });

  await supabase.from("billing_credits").insert({
    billing_account_id: billingAccountId,
    amount,
    remaining_amount: amount,
    reason: `Refund: ${reason}`,
    created_by: user?.id ?? null,
  });

  await supabase.rpc("sync_billing_account_balance", { p_account_id: billingAccountId });
  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function enrollAutopayAction(formData: FormData) {
  const supabase = await createAuthClient();
  const billingAccountId = formData.get("billing_account_id") as string;

  const { error } = await supabase.from("family_autopay_enrollments").insert({
    billing_account_id: billingAccountId,
    payment_method_id: (formData.get("payment_method_id") as string) || null,
    day_of_month: Number(formData.get("day_of_month") || 1),
    status: "active",
  });

  if (error) return { error: error.message };

  await supabase
    .from("family_billing_accounts")
    .update({ autopay_enabled: true })
    .eq("id", billingAccountId);

  revalidatePath("/apply/portal/finance");
  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function registerFundingDocumentAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const studentId = formData.get("student_id") as string;
  const fileName = formData.get("file_name") as string;
  const documentType = (formData.get("document_type") as string) || "funding_verification";

  const { error } = await supabase.from("student_documents").insert({
    student_id: studentId,
    document_type: documentType,
    file_name: fileName,
    storage_path: `portal-uploads/${studentId}/${Date.now()}-${fileName}`,
    uploaded_by: user?.id ?? null,
    status: "active",
  });

  if (error) return { error: error.message };
  revalidatePath("/apply/portal/finance");
  return { success: true };
}

export async function acknowledgeFinancialAgreementAction(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const billingAccountId = formData.get("billing_account_id") as string;
  const familyId = formData.get("family_id") as string;

  await writePlatformAudit(supabase, {
    module: "finance",
    entityType: "family_billing_account",
    entityId: billingAccountId,
    actionType: "agreement_acknowledged",
    summary: "Family acknowledged financial agreement via portal",
    actorUserId: user?.id,
    metadata: { family_id: familyId },
  });

  revalidatePath("/apply/portal/finance");
  return { success: true };
}

export async function recordPortalPaymentAction(formData: FormData) {
  return recordPayment(formData);
}
