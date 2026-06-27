import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { EdpImportType, EdpSourceFormat, FieldMapping } from "@/lib/enterprise-data/types";

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

export async function createImportBatch(
  supabase: AuthClient,
  input: {
    organizationId: string;
    importType: EdpImportType;
    sourceFormat: EdpSourceFormat;
    fileName?: string;
    sourceSystem?: string;
    importedBy?: string;
    schoolId?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_import_batches")
    .insert({
      organization_id: input.organizationId,
      school_id: input.schoolId ?? null,
      import_type: input.importType,
      source_format: input.sourceFormat,
      file_name: input.fileName ?? null,
      source_system: input.sourceSystem ?? null,
      imported_by: input.importedBy ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { batchId: data.id };
}

export async function parseAndStageImport(
  supabase: AuthClient,
  batchId: string,
  content: string,
  mappings: FieldMapping[]
) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { error: "File must include header and data rows" };

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = cols[idx] ?? ""; });

    const mapped: Record<string, unknown> = {};
    for (const m of mappings) {
      const src = m.sourceField.toLowerCase().replace(/\s+/g, "_");
      mapped[m.targetField] = raw[src] ?? m.defaultValue ?? "";
    }

    records.push({
      batch_id: batchId,
      row_number: i,
      raw_data: raw,
      mapped_data: mapped,
      status: "pending",
    });
  }

  await supabase.from("edp_import_records").insert(records);
  await supabase.from("edp_import_batches").update({ row_count: records.length, status: "mapping" }).eq("id", batchId);

  return { rowCount: records.length };
}

export async function commitImportBatch(supabase: AuthClient, batchId: string, importType: EdpImportType) {
  const { data: records } = await supabase
    .from("edp_import_records")
    .select("*")
    .eq("batch_id", batchId)
    .in("status", ["valid", "warning"]);

  let success = 0;
  let errors = 0;

  for (const rec of records ?? []) {
    try {
      if (importType === "quickbooks" || importType === "financial_transaction") {
        const mapped = rec.mapped_data as Record<string, unknown>;
        const { data: school } = await supabase.from("schools").select("id").limit(1).maybeSingle();
        if (school?.id) {
          await supabase.from("fi_external_transactions").insert({
            school_id: school.id,
            import_batch_id: null,
            transaction_date: String(mapped.transaction_date ?? mapped.date ?? new Date().toISOString().split("T")[0]),
            account_name: String(mapped.account_name ?? ""),
            amount: Number(mapped.amount ?? 0),
            debit_amount: Number(mapped.amount ?? 0) > 0 ? Number(mapped.amount ?? 0) : 0,
            credit_amount: Number(mapped.amount ?? 0) < 0 ? Math.abs(Number(mapped.amount ?? 0)) : 0,
            description: String(mapped.description ?? ""),
            source_system: "edp_import",
            reconciliation_status: "unmatched",
          });
        }
      }
      await supabase.from("edp_import_records").update({ status: "imported" }).eq("id", rec.id);
      success++;
    } catch {
      await supabase.from("edp_import_records").update({ status: "error", errors: [{ message: "Import failed" }] }).eq("id", rec.id);
      errors++;
    }
  }

  await supabase.from("edp_import_batches").update({
    status: errors ? "failed" : "completed",
    success_count: success,
    error_count: errors,
    completed_at: new Date().toISOString(),
  }).eq("id", batchId);

  return { success, errors };
}

export async function getImportHistory(supabase: AuthClient, organizationId: string, limit = 20) {
  const { data } = await supabase
    .from("edp_import_batches")
    .select("*")
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function rollbackImportBatch(supabase: AuthClient, batchId: string) {
  await supabase.from("edp_import_batches").update({ status: "rolled_back" }).eq("id", batchId);
  return { success: true };
}
