import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { EdpExportFormat } from "@/lib/enterprise-data/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export function buildCsvExport(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows.map((row) =>
    columns.map((col) => {
      const val = row[col];
      const str = val == null ? "" : String(val);
      return str.includes(",") ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  ).join("\n");
  return `${header}\n${body}`;
}

export async function createExportBatch(
  supabase: AuthClient,
  input: {
    organizationId: string;
    exportType: string;
    exportFormat: EdpExportFormat;
    exportedBy?: string;
    schoolId?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_export_batches")
    .insert({
      organization_id: input.organizationId,
      school_id: input.schoolId ?? null,
      export_type: input.exportType,
      export_format: input.exportFormat,
      exported_by: input.exportedBy ?? null,
      status: "processing",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { batchId: data.id };
}

export async function exportStudents(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("students").select("id, first_name, last_name, grade_level, lifecycle_stage, school_id");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query.limit(5000);
  return data ?? [];
}

export async function exportEmployees(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("employees").select("id, school_id, employment_status, user_id");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query.limit(5000);
  return data ?? [];
}

export async function runExport(
  supabase: AuthClient,
  input: {
    organizationId: string;
    exportType: string;
    exportFormat: EdpExportFormat;
    schoolId?: string;
    exportedBy?: string;
  }
) {
  const batch = await createExportBatch(supabase, input);
  if (batch.error || !batch.batchId) return batch;

  let rows: Record<string, unknown>[] = [];
  if (input.exportType === "students") rows = await exportStudents(supabase, input.schoolId);
  else if (input.exportType === "employees") rows = await exportEmployees(supabase, input.schoolId);

  const columns = rows.length ? Object.keys(rows[0]) : ["id"];
  const csv = buildCsvExport(rows, columns);

  await supabase.from("edp_export_batches").update({
    status: "completed",
    row_count: rows.length,
    completed_at: new Date().toISOString(),
    metadata: { columns },
  }).eq("id", batch.batchId);

  return { batchId: batch.batchId, csv, rowCount: rows.length };
}

export async function getExportHistory(supabase: AuthClient, organizationId: string, limit = 20) {
  const { data } = await supabase
    .from("edp_export_batches")
    .select("*")
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
