import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface LedgerEntryInput {
  schoolId: string;
  sourceModule: string;
  transactionType: string;
  category: string;
  amount: number;
  transactionDate?: string;
  studentId?: string | null;
  familyId?: string | null;
  program?: string | null;
  fundingSourceCode?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  scholarshipApplicationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  description?: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordFinancialTransaction(supabase: AuthClient, input: LedgerEntryInput) {
  await supabase.from("financial_transactions").insert({
    school_id: input.schoolId,
    source_module: input.sourceModule,
    transaction_type: input.transactionType,
    category: input.category,
    amount: input.amount,
    transaction_date: input.transactionDate ?? new Date().toISOString().split("T")[0],
    student_id: input.studentId ?? null,
    family_id: input.familyId ?? null,
    program: input.program ?? null,
    funding_source_code: input.fundingSourceCode ?? null,
    invoice_id: input.invoiceId ?? null,
    payment_id: input.paymentId ?? null,
    scholarship_application_id: input.scholarshipApplicationId ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    description: input.description ?? null,
    created_by: input.createdBy ?? null,
    metadata: input.metadata ?? {},
    approval_status: "posted",
  });
}

export async function exportLedgerForGl(
  supabase: AuthClient,
  schoolId: string,
  dateFrom: string,
  dateTo: string
) {
  const { data } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("school_id", schoolId)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo)
    .order("transaction_date");

  return (data ?? []).map((t) => ({
    date: t.transaction_date,
    source_module: t.source_module,
    type: t.transaction_type,
    category: t.category,
    amount: t.amount,
    student_id: t.student_id,
    family_id: t.family_id,
    program: t.program,
    funding_source: t.funding_source_code,
    description: t.description,
    approval_status: t.approval_status,
  }));
}
