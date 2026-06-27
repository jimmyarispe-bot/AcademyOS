import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { EdpImportType, FieldMapping, ImportPreviewRow, ValidationIssue } from "@/lib/enterprise-data/types";
import { mapRecord } from "@/lib/enterprise-data/mapping-engine";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function validateRequired(mapped: Record<string, unknown>, mappings: FieldMapping[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const m of mappings.filter((f) => f.required)) {
    if (!mapped[m.targetField]) {
      issues.push({
        severity: "error",
        message: `Required field missing: ${m.targetField}`,
        fieldName: m.targetField,
        resolutionHint: `Map source field to ${m.targetField}`,
      });
    }
  }
  return issues;
}

function validateDuplicates(rows: ImportPreviewRow[]): ValidationIssue[] {
  const seen = new Map<string, number>();
  const issues: ValidationIssue[] = [];
  for (const row of rows) {
    const key = `${row.mapped.first_name ?? ""}|${row.mapped.last_name ?? ""}|${row.mapped.email ?? ""}`.toLowerCase();
    if (key === "||") continue;
    if (seen.has(key)) {
      issues.push({
        severity: "warning",
        message: `Possible duplicate at row ${row.rowNumber} (matches row ${seen.get(key)})`,
        rowNumber: row.rowNumber,
        resolutionHint: "Review duplicate records before import",
      });
    } else seen.set(key, row.rowNumber);
  }
  return issues;
}

export async function validateImportBatch(
  supabase: AuthClient,
  batchId: string,
  importType: EdpImportType,
  mappings: FieldMapping[]
) {
  const { data: records } = await supabase.from("edp_import_records").select("*").eq("batch_id", batchId);
  const previewRows: ImportPreviewRow[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const rec of records ?? []) {
    const raw = rec.raw_data as Record<string, unknown>;
    const mapped = mapRecord(raw, mappings);
    const issues = validateRequired(mapped, mappings);

    if (importType === "student" && !mapped.school_id) {
      issues.push({
        severity: "error",
        message: "Missing school assignment",
        fieldName: "school_id",
        rowNumber: rec.row_number,
        resolutionHint: "Map school_id or set default school",
      });
    }

    const status = issues.some((i) => i.severity === "error") ? "error" : issues.length ? "warning" : "valid";
    if (status === "error") errorCount++;
    else if (status === "warning") warningCount++;

    previewRows.push({ rowNumber: rec.row_number, raw, mapped, status, issues });

    await supabase.from("edp_import_records").update({
      mapped_data: mapped,
      status,
      errors: issues.filter((i) => i.severity === "error"),
      warnings: issues.filter((i) => i.severity !== "error"),
    }).eq("id", rec.id);

    for (const issue of issues) {
      await supabase.from("edp_validation_results").insert({
        batch_id: batchId,
        validation_type: importType,
        severity: issue.severity,
        message: issue.message,
        field_name: issue.fieldName ?? null,
        row_number: issue.rowNumber ?? rec.row_number,
        resolution_hint: issue.resolutionHint ?? null,
      });
    }
  }

  const dupIssues = validateDuplicates(previewRows);
  warningCount += dupIssues.length;

  await supabase.from("edp_import_batches").update({
    status: "preview",
    error_count: errorCount,
    warning_count: warningCount,
    validation_summary: { errorCount, warningCount, duplicateWarnings: dupIssues.length },
  }).eq("id", batchId);

  return { previewRows, errorCount, warningCount, recommendations: dupIssues };
}

export async function getValidationResults(supabase: AuthClient, batchId: string) {
  const { data } = await supabase
    .from("edp_validation_results")
    .select("*")
    .eq("batch_id", batchId)
    .order("severity")
    .order("row_number");
  return data ?? [];
}
