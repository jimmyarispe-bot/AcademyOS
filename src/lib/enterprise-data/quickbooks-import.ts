import type { createAuthClient } from "@/lib/supabase/server-auth";
import {
  createImportBatch as createFiBatch,
  importChartOfAccountsRows,
  importTransactionRows,
} from "@/lib/financial-intelligence/quickbooks-import";
import type { QuickBooksImportType } from "@/lib/financial-intelligence/quickbooks-import";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/** Routes QuickBooks imports through FI layer — never overwrites operational records */
export async function importQuickBooksViaEdp(
  supabase: AuthClient,
  input: {
    schoolId: string;
    importType: QuickBooksImportType;
    fileName?: string;
    importedBy?: string;
    rows: Record<string, string>[];
  }
) {
  const batch = await createFiBatch(supabase, {
    schoolId: input.schoolId,
    importType: input.importType,
    sourceSystem: "quickbooks",
    fileName: input.fileName,
    importedBy: input.importedBy,
  });

  if (batch.error || !batch.batchId) return batch;

  if (input.importType === "chart_of_accounts") {
    return importChartOfAccountsRows(
      supabase,
      batch.batchId,
      input.schoolId,
      input.rows.map((r) => ({
        accountNumber: r.account_number ?? r.accountNumber,
        accountName: r.account_name ?? r.accountName ?? "",
        accountType: r.account_type ?? r.accountType,
        parentAccount: r.parent_account ?? r.parentAccount,
      }))
    );
  }

  if (input.importType === "transactions" || input.importType === "general_ledger") {
    return importTransactionRows(
      supabase,
      batch.batchId,
      input.schoolId,
      input.rows.map((r) => ({
        transactionDate: r.date ?? r.transaction_date ?? "",
        accountName: r.account_name ?? r.accountName ?? "",
        amount: Number(r.amount ?? 0),
        description: r.description ?? r.memo ?? "",
        externalId: r.reference ?? r.ref_number,
      }))
    );
  }

  return { batchId: batch.batchId, imported: 0, note: "Import type staged — reconciliation preserved" };
}

export const QUICKBOOKS_IMPORT_TYPES: Array<{ value: QuickBooksImportType; label: string }> = [
  { value: "chart_of_accounts", label: "Chart of Accounts" },
  { value: "general_ledger", label: "General Ledger" },
  { value: "journal_entries", label: "Journal Entries" },
  { value: "profit_loss", label: "Profit & Loss" },
  { value: "balance_sheet", label: "Balance Sheet" },
  { value: "cash_flow", label: "Cash Flow" },
  { value: "budget", label: "Budgets" },
  { value: "payroll_summary", label: "Payroll Summaries" },
  { value: "customers", label: "Customers" },
  { value: "vendors", label: "Vendors" },
  { value: "classes", label: "Classes" },
  { value: "locations", label: "Locations" },
  { value: "transactions", label: "Transactions" },
  { value: "historical", label: "Historical Statements" },
];
