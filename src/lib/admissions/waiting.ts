import { createAuthClient } from "@/lib/supabase/server-auth";

/**
 * Families waiting on us — every open admissions task, oldest first, with
 * enough contact detail to pick up the phone without opening anything else.
 *
 * WHY THIS EXISTS. On 9 September 2026 there were 113 families sitting at
 * `information_sent` with no open task between them, the oldest since 2
 * February. Migration 316 created the missing tasks. But getting a call list
 * out of them still meant writing SQL against `admissions_tasks`, and a queue
 * nobody can see is the same as no queue — which is how the 113 happened in the
 * first place. This is the screen that makes the backlog answerable.
 *
 * ORDERED BY DUE DATE, NOT CREATION. 316 dated each backfilled task
 * `inquiry_date + 3 days` — the date the workflow would have set had it ever
 * run — so due date carries seven months of real difference. Sorting by it puts
 * the longest-neglected family first. Sorting by `created_at` would put them
 * all in one indistinguishable pile stamped the day of the backfill.
 *
 * TWO QUERIES, JOINED IN MEMORY, ON PURPOSE. `admissions_tasks` reaches
 * `admissions_leads` through a foreign key still named
 * `admissions_tasks_prospect_id_fkey`, from before leads were called leads. A
 * PostgREST embed across a key whose name no longer matches either table is a
 * standing invitation to a silent empty result, and this file exists precisely
 * because silent emptiness went unnoticed for seven months. Two plain reads and
 * a Map cannot fail that way.
 */

/** Anything past this is a stale queue, not a workload. Rendered, but marked. */
export const STALE_AFTER_DAYS = 30;

export type WaitingFamily = {
  taskId: string;
  taskName: string;
  dueDate: string | null;
  /** Whole days past due. Negative means not due yet. Null when undated. */
  daysOverdue: number | null;
  leadId: string;
  studentName: string;
  applyingForGrade: string | null;
  leadStage: string;
  campus: string;
  schoolId: string;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  /** A real, complete link. Never a placeholder — Jimmy pastes what he is given. */
  caseHref: string;
};

export type WaitingCampus = {
  schoolId: string;
  campus: string;
  waiting: number;
  /** Days overdue on the worst one. Null when nothing in this campus is dated. */
  worstDaysOverdue: number | null;
};

export type WaitingList = {
  families: WaitingFamily[];
  campuses: WaitingCampus[];
  total: number;
  /** Set when the list cannot be shown. The page renders this instead of "0 families". */
  unavailable: string | null;
};

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  if (Number.isNaN(from.getTime())) return 0;
  const today = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((today - from.getTime()) / 86_400_000);
}

function guardianName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name.length ? name : null;
}

function unavailable(reason: string): WaitingList {
  return { families: [], campuses: [], total: 0, unavailable: reason };
}

export async function getFamiliesWaiting(): Promise<WaitingList> {
  const supabase = await createAuthClient();

  // Check the returned error, every time. supabase-js resolves an RLS refusal
  // with `{ error }` rather than throwing, so a bare await turns a policy
  // refusal into an empty list that looks like good news. Six faults in this
  // codebase have been exactly that shape, including the one that let these
  // families sit unseen.
  const { data: tasks, error: tasksError } = await supabase
    .from("admissions_tasks")
    .select("id, task_name, due_date, lead_id")
    .eq("task_status", "open")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (tasksError) return unavailable(`Could not read the task queue: ${tasksError.message}`);

  const openTasks = tasks ?? [];
  if (!openTasks.length) {
    return { families: [], campuses: [], total: 0, unavailable: null };
  }

  const leadIds = Array.from(new Set(openTasks.map((t) => t.lead_id).filter(Boolean)));

  const [leadsRes, schoolsRes] = await Promise.all([
    supabase
      .from("admissions_leads")
      // ONE STRING LITERAL, NOT A CONCATENATION. The generated types read the
      // select list as a literal type to work out the row shape; splitting it
      // over `+` widens it to `string` and every column below resolves to
      // `GenericStringError`. Keep this on one line however long it gets.
      .select("id, first_name, last_name, preferred_name, applying_for_grade, lead_stage, school_id, guardian_first_name, guardian_last_name, guardian_email, guardian_phone")
      .in("id", leadIds),
    supabase.from("schools").select("id, name"),
  ]);

  if (leadsRes.error) return unavailable(`Could not read the families: ${leadsRes.error.message}`);
  if (schoolsRes.error) return unavailable(`Could not read the campuses: ${schoolsRes.error.message}`);

  const leadById = new Map((leadsRes.data ?? []).map((l) => [l.id, l]));
  const schoolNameById = new Map((schoolsRes.data ?? []).map((s) => [s.id, s.name]));

  const now = new Date();

  const families: WaitingFamily[] = [];
  for (const task of openTasks) {
    const lead = leadById.get(task.lead_id);
    // A task whose lead has been deleted is a data fault, not a family. It is
    // dropped rather than rendered as a blank row somebody would try to call.
    if (!lead) continue;

    const student =
      [lead.preferred_name || lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
      "Unnamed student";

    families.push({
      taskId: task.id,
      taskName: task.task_name,
      dueDate: task.due_date,
      daysOverdue: task.due_date ? daysBetween(task.due_date, now) : null,
      leadId: lead.id,
      studentName: student,
      applyingForGrade: lead.applying_for_grade,
      leadStage: lead.lead_stage,
      schoolId: lead.school_id,
      campus: schoolNameById.get(lead.school_id) ?? "Unassigned campus",
      guardianName: guardianName(lead.guardian_first_name, lead.guardian_last_name),
      guardianEmail: lead.guardian_email,
      guardianPhone: lead.guardian_phone,
      caseHref: `/dashboard/admissions/cases/${lead.id}?section=tasks`,
    });
  }

  // Undated tasks sort last. They are real work, but they carry no claim about
  // how long anyone has been waiting, so they must not displace a family who
  // has been waiting since February.
  families.sort((a, b) => {
    if (a.dueDate == null && b.dueDate == null) return 0;
    if (a.dueDate == null) return 1;
    if (b.dueDate == null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  const byCampus = new Map<string, WaitingCampus>();
  for (const f of families) {
    const existing = byCampus.get(f.schoolId);
    if (!existing) {
      byCampus.set(f.schoolId, {
        schoolId: f.schoolId,
        campus: f.campus,
        waiting: 1,
        worstDaysOverdue: f.daysOverdue,
      });
      continue;
    }
    existing.waiting += 1;
    if (f.daysOverdue != null && (existing.worstDaysOverdue == null || f.daysOverdue > existing.worstDaysOverdue)) {
      existing.worstDaysOverdue = f.daysOverdue;
    }
  }

  const campuses = Array.from(byCampus.values()).sort((a, b) => b.waiting - a.waiting);

  return { families, campuses, total: families.length, unavailable: null };
}
