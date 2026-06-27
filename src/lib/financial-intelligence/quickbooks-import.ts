import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export type QuickBooksImportType =
  | "chart_of_accounts"
  | "general_ledger"
  | "journal_entries"
  | "profit_loss"
  | "balance_sheet"
  | "cash_flow"
  | "budget"
  | "payroll_summary"
  | "vendors"
  | "customers"
  | "classes"
  | "locations"
  | "transactions"
  | "historical";

/** Framework for QuickBooks / QBO / IIF imports — preserves source tracking, no ops replacement */
export async function createImportBatch(
  supabase: AuthClient,
  input: {
    schoolId: string;
    importType: QuickBooksImportType;
    sourceSystem: "quickbooks" | "csv" | "excel" | "iif" | "qbo_export";
    fileName?: string;
    fileFormat?: string;
    importedBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("fi_import_batches")
    .insert({
      school_id: input.schoolId,
      import_type: input.importType,
      source_system: input.sourceSystem,
      file_name: input.fileName ?? null,
      file_format: input.fileFormat ?? null,
      imported_by: input.importedBy ?? null,
      status: "processing",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { batchId: data.id };
}

export async function importChartOfAccountsRows(
  supabase: AuthClient,
  batchId: string,
  schoolId: string,
  rows: { accountNumber?: string; accountName: string; accountType?: string; parentAccount?: string }[]
) {
  const inserts = rows.map((r) => ({
    school_id: schoolId,
    import_batch_id: batchId,
    account_number: r.accountNumber ?? null,
    account_name: r.accountName,
    account_type: r.accountType ?? null,
    parent_account: r.parentAccount ?? null,
    source_system: "quickbooks",
  }));

  if (inserts.length) {
    await supabase.from("fi_external_accounts").insert(inserts);
  }

  await supabase
    .from("fi_import_batches")
    .update({ status: "completed", row_count: inserts.length })
    .eq("id", batchId);

  return { imported: inserts.length };
}

export async function importTransactionRows(
  supabase: AuthClient,
  batchId: string,
  schoolId: string,
  rows: {
    transactionDate: string;
    accountName?: string;
    accountNumber?: string;
    amount: number;
    description?: string;
    className?: string;
    locationName?: string;
    vendorName?: string;
    customerName?: string;
    externalId?: string;
  }[]
) {
  const inserts = rows.map((r) => ({
    school_id: schoolId,
    import_batch_id: batchId,
    external_transaction_id: r.externalId ?? null,
    transaction_date: r.transactionDate,
    account_name: r.accountName ?? null,
    account_number: r.accountNumber ?? null,
    amount: r.amount,
    debit_amount: r.amount > 0 ? r.amount : 0,
    credit_amount: r.amount < 0 ? Math.abs(r.amount) : 0,
    description: r.description ?? null,
    class_name: r.className ?? null,
    location_name: r.locationName ?? null,
    vendor_name: r.vendorName ?? null,
    customer_name: r.customerName ?? null,
    source_system: "quickbooks",
    reconciliation_status: "unmatched",
  }));

  if (inserts.length) {
    await supabase.from("fi_external_transactions").insert(inserts);
  }

  await supabase
    .from("fi_import_batches")
    .update({ status: "completed", row_count: inserts.length })
    .eq("id", batchId);

  return { imported: inserts.length };
}

export async function getImportBatches(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("fi_import_batches").select("*").order("imported_at", { ascending: false }).limit(20);
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}

/** Future direct API sync architecture placeholder */
export const QBO_API_SYNC_ARCHITECTURE = {
  oauthEndpoint: "/api/financial-intelligence/quickbooks/connect",
  syncEndpoint: "/api/financial-intelligence/quickbooks/sync",
  supportedEntities: ["Account", "JournalEntry", "Invoice", "Bill", "Purchase", "Deposit"],
  reconciliationStrategy: "source_tracking_with_fi_external_transactions",
} as const;
