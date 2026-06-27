import type { createAuthClient } from "@/lib/supabase/server-auth";
import {
  createImportBatch,
  importChartOfAccountsRows,
  importTransactionRows,
  type QuickBooksImportType,
} from "@/lib/financial-intelligence/quickbooks-import";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += ch;
  }
  result.push(current.trim());
  return result;
}

export async function importCsvFinancialData(
  supabase: AuthClient,
  input: {
    schoolId: string;
    importType: QuickBooksImportType;
    csvContent: string;
    fileName?: string;
    importedBy?: string;
  }
) {
  const lines = input.csvContent.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { error: "CSV must include header and at least one row" };

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const batch = await createImportBatch(supabase, {
    schoolId: input.schoolId,
    importType: input.importType,
    sourceSystem: "csv",
    fileName: input.fileName,
    importedBy: input.importedBy,
  });

  if (batch.error || !batch.batchId) return { error: batch.error ?? "Failed to create batch" };

  if (input.importType === "chart_of_accounts") {
    const rows = lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const map: Record<string, string> = {};
      headers.forEach((h, i) => { map[h] = cols[i] ?? ""; });
      return {
        accountNumber: map.account_number || map.number,
        accountName: map.account_name || map.name || cols[0],
        accountType: map.account_type || map.type,
        parentAccount: map.parent_account,
      };
    }).filter((r) => r.accountName);

    const result = await importChartOfAccountsRows(supabase, batch.batchId, input.schoolId, rows);
    return { batchId: batch.batchId, ...result };
  }

  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const map: Record<string, string> = {};
    headers.forEach((h, i) => { map[h] = cols[i] ?? ""; });
    return {
      transactionDate: map.date || map.transaction_date || new Date().toISOString().split("T")[0],
      accountName: map.account || map.account_name,
      accountNumber: map.account_number,
      amount: Number(map.amount || map.debit || cols[cols.length - 1] || 0),
      description: map.description || map.memo,
      className: map.class,
      locationName: map.location,
      vendorName: map.vendor,
      customerName: map.customer,
      externalId: map.transaction_id || map.id,
    };
  }).filter((r) => r.amount !== 0 || r.description);

  const result = await importTransactionRows(supabase, batch.batchId, input.schoolId, rows);
  return { batchId: batch.batchId, ...result };
}
