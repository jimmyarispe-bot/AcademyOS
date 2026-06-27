import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface WorkReportRow {
  label: string;
  value: string | number;
  category?: string;
}

export async function getProjectSummaryReport(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("rpt_work_project_summary").select("*");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}

export async function getTaskSummaryReport(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("rpt_work_task_summary").select("*");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}

export async function getEmployeeWorkloadReport(supabase: AuthClient, schoolId?: string) {
  let query = supabase
    .from("work_tasks")
    .select("owner_user_id, status, estimated_hours, actual_hours, users(full_name)")
    .not("status", "in", '("cancelled","completed")');

  if (schoolId) query = query.eq("school_id", schoolId);

  const { data } = await query;
  const byUser: Record<string, WorkReportRow[]> = {};

  for (const row of data ?? []) {
    const uid = row.owner_user_id ?? "unassigned";
    const name = (row.users as { full_name?: string } | null)?.full_name ?? uid;
    if (!byUser[name]) byUser[name] = [];
    byUser[name].push({
      label: row.status,
      value: Number(row.estimated_hours ?? 0),
      category: "hours",
    });
  }

  return byUser;
}

export function buildCsvExport(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns.map((col) => {
      const val = row[col];
      const str = val == null ? "" : String(val);
      return str.includes(",") ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  return [header, ...lines].join("\n");
}

export async function getPlaybookPerformanceReport(supabase: AuthClient) {
  const { data } = await supabase
    .from("work_playbook_runs")
    .select("status, playbook_id, work_playbooks(name, playbook_key)")
    .order("started_at", { ascending: false })
    .limit(100);

  const counts: Record<string, { name: string; runs: number; completed: number }> = {};

  for (const run of data ?? []) {
    const pb = Array.isArray(run.work_playbooks) ? run.work_playbooks[0] : run.work_playbooks;
    const key = (pb as { playbook_key?: string })?.playbook_key ?? run.playbook_id;
    if (!counts[key]) {
      counts[key] = {
        name: (pb as { name?: string })?.name ?? key,
        runs: 0,
        completed: 0,
      };
    }
    counts[key].runs++;
    if (run.status === "completed") counts[key].completed++;
  }

  return Object.values(counts);
}
