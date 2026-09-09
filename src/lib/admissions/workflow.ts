import type { LeadStageValue } from "@/lib/constants/admissions";
import {
  getPipelineStageAutomatedTask,
  resolvePipelineStageFromLeadStage,
} from "@/lib/admissions/registry";
import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface StageHistoryEntry {
  id: string;
  lead_id: string;
  previous_stage: string | null;
  new_stage: string;
  changed_by: string | null;
  changed_at: string;
  users?: { full_name: string | null } | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export function daysInCurrentStage(stageEnteredAt: string | null | undefined): number {
  if (!stageEnteredAt) return 0;
  return Math.max(0, daysBetween(new Date(stageEnteredAt), new Date()));
}

export function totalDaysInPipeline(inquiryDate: string): number {
  return Math.max(0, daysBetween(new Date(inquiryDate), new Date()));
}

export function pipelineAgingClasses(days: number): string {
  if (days <= 7) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (days <= 14) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-red-100 text-red-800 border-red-200";
}

export function pipelineAgingDotClass(days: number): string {
  if (days <= 7) return "bg-emerald-500";
  if (days <= 14) return "bg-amber-500";
  return "bg-red-500";
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const STANDARD_AUTOMATED_TASKS: Partial<
  Record<LeadStageValue, { taskName: string; dueDays: number }>
> = {
  information_sent: { taskName: "Follow up on information sent", dueDays: 3 },
  application_started: { taskName: "Follow up on application progress", dueDays: 7 },
  records_requested: { taskName: "Follow up on records request", dueDays: 5 },
  accepted: { taskName: "Enrollment follow-up", dueDays: 3 },
};

/**
 * Returns the error instead of discarding it.
 *
 * The previous version awaited the insert and threw the result away, so a
 * refusal — RLS, a missing column, a constraint — was indistinguishable from
 * success. supabase-js does not throw on a policy refusal; it resolves with
 * `{ error }`, which a bare `await` silently drops. That is the failure pattern
 * recorded in open-items.md and this was its sixth instance. actions.ts:179
 * makes the identical insert and has always checked; this one never did.
 */
async function createAutomatedTask(
  supabase: AuthClient,
  leadId: string,
  taskName: string,
  dueDate: string
): Promise<{ error?: string }> {
  const { error } = await supabase.from("admissions_tasks").insert({
    lead_id: leadId,
    task_name: taskName,
    due_date: dueDate,
    task_status: "open",
  });
  return error ? { error: error.message } : {};
}

export async function createStageAutomatedTasks(
  supabase: AuthClient,
  leadId: string,
  newStage: LeadStageValue,
  options?: { tourScheduledAt?: string }
): Promise<{ error?: string }> {
  if (newStage === "tour_scheduled") {
    let tourDate: Date | null = null;

    if (options?.tourScheduledAt) {
      tourDate = new Date(options.tourScheduledAt);
    } else {
      const { data: tour } = await supabase
        .from("admissions_tours")
        .select("scheduled_at")
        .eq("lead_id", leadId)
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tour?.scheduled_at) {
        tourDate = new Date(tour.scheduled_at);
      }
    }

    if (tourDate && !Number.isNaN(tourDate.getTime())) {
      return await createAutomatedTask(
        supabase,
        leadId,
        "Tour reminder — contact family",
        formatDateISO(addDays(tourDate, -1))
      );
    }
    return {};
  }

  const config = STANDARD_AUTOMATED_TASKS[newStage];
  const pipelineStage = resolvePipelineStageFromLeadStage(newStage);
  const registryTask = pipelineStage ? getPipelineStageAutomatedTask(pipelineStage) : undefined;
  const taskConfig = registryTask ?? config;
  if (!taskConfig) return {};

  return await createAutomatedTask(
    supabase,
    leadId,
    taskConfig.taskName,
    formatDateISO(addDays(new Date(), taskConfig.dueDays))
  );
}

export async function transitionLeadStage(
  supabase: AuthClient,
  leadId: string,
  newStage: LeadStageValue,
  changedBy: string | null,
  options?: { tourScheduledAt?: string }
): Promise<{ error?: string; success?: boolean; taskError?: string }> {
  const { data: lead, error: fetchError } = await supabase
    .from("admissions_leads")
    .select("lead_stage")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return { error: fetchError?.message ?? "Lead not found" };
  }

  const previousStage = lead.lead_stage;
  if (previousStage === newStage) {
    return { success: true };
  }

  const now = new Date().toISOString();

  const { error: historyError } = await supabase
    .from("admissions_lead_stage_history")
    .insert({
      lead_id: leadId,
      previous_stage: previousStage,
      new_stage: newStage,
      changed_by: changedBy,
      changed_at: now,
    });

  if (historyError) return { error: historyError.message };

  const { error: updateError } = await supabase
    .from("admissions_leads")
    .update({ lead_stage: newStage })
    .eq("id", leadId);

  if (updateError) return { error: updateError.message };

  const taskResult = await createStageAutomatedTasks(supabase, leadId, newStage, options);
  if (taskResult.error) {
    // The stage change is committed and correct; only the follow-up task is
    // missing. Returning an error here would report a transition that did
    // happen as one that did not, so it is surfaced beside the success and
    // logged where a person can see it.
    console.error(
      "[transitionLeadStage] stage advanced but the follow-up task was not created",
      { leadId, newStage, error: taskResult.error }
    );
    return { success: true, taskError: taskResult.error };
  }

  return { success: true };
}

/**
 * Record that a lead began at `new_inquiry`. History only — no task.
 *
 * DO NOT CREATE A TASK HERE. It has been tried, on 9 September 2026, and it
 * gave every new family two rows on "Families waiting on us". The opening task
 * already exists and comes from somewhere else: the `wf_inquiry_submitted`
 * workflow, seeded by migration 070 into `admissions_workflow_steps`, whose
 * `create_internal_task` step opens "Follow up on new inquiry" due in 1 day and
 * assigns it to the counsellor. `onInquirySubmitted` fires that engine, and all
 * three creation paths call it — the public form at /apply, staff "Add Lead",
 * and the portal tour and discovery-call pages.
 *
 * The mistake that produced the duplicate was reading this function and
 * `STANDARD_AUTOMATED_TASKS`, seeing `onInquirySubmitted` was only a
 * `dispatch(...)` call, and stopping there instead of following it into
 * `dispatchAdmissionsAutomation`. Two task systems exist in this codebase — the
 * registry-driven one below, and the database-configured workflow engine. When
 * adding automatic task creation, check BOTH.
 *
 * ERRORS ARE RETURNED AND LOGGED. Three call sites await this and ignore the
 * result, and supabase-js resolves an RLS refusal rather than throwing, so a
 * lead with no stage history would otherwise be written in silence.
 */
export async function recordInitialStage(
  supabase: AuthClient,
  leadId: string,
  changedBy: string | null
): Promise<{ error?: string }> {
  const now = new Date().toISOString();

  const { error: historyError } = await supabase
    .from("admissions_lead_stage_history")
    .insert({
      lead_id: leadId,
      previous_stage: null,
      new_stage: "new_inquiry",
      changed_by: changedBy,
      changed_at: now,
    });

  if (historyError) {
    console.error("[recordInitialStage] stage history", { leadId, error: historyError.message });
  }

  return { error: historyError?.message };
}

export interface StageDurationStats {
  stage: string;
  label: string;
  avgDays: number;
  sampleSize: number;
}

export interface PipelineVelocityStats {
  avgDaysToAcceptance: number | null;
  avgDaysToEnrollment: number | null;
  acceptedCount: number;
  enrolledCount: number;
}

export function computeStageDurationStats(
  history: StageHistoryEntry[],
  leads: { id: string; lead_stage: string; stage_entered_at?: string | null }[],
  stageLabels: Record<string, string>
): StageDurationStats[] {
  const durationsByStage: Record<string, number[]> = {};

  const historyByLead = history.reduce<Record<string, StageHistoryEntry[]>>((acc, entry) => {
    if (!acc[entry.lead_id]) acc[entry.lead_id] = [];
    acc[entry.lead_id].push(entry);
    return acc;
  }, {});

  for (const entries of Object.values(historyByLead)) {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const stage = prev.new_stage;
      const days = daysBetween(new Date(prev.changed_at), new Date(curr.changed_at));
      if (!durationsByStage[stage]) durationsByStage[stage] = [];
      durationsByStage[stage].push(days);
    }
  }

  for (const lead of leads) {
    if (!lead.stage_entered_at) continue;
    const days = daysInCurrentStage(lead.stage_entered_at);
    if (!durationsByStage[lead.lead_stage]) durationsByStage[lead.lead_stage] = [];
    durationsByStage[lead.lead_stage].push(days);
  }

  return Object.entries(durationsByStage)
    .map(([stage, durations]) => ({
      stage,
      label: stageLabels[stage] ?? stage,
      avgDays: durations.length
        ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
        : 0,
      sampleSize: durations.length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function computePipelineVelocity(
  history: StageHistoryEntry[],
  inquiryDates: Record<string, string>
): PipelineVelocityStats {
  const historyByLead = history.reduce<Record<string, StageHistoryEntry[]>>((acc, entry) => {
    if (!acc[entry.lead_id]) acc[entry.lead_id] = [];
    acc[entry.lead_id].push(entry);
    return acc;
  }, {});

  const acceptanceDays: number[] = [];
  const enrollmentDays: number[] = [];

  for (const [leadId, entries] of Object.entries(historyByLead)) {
    const inquiryDate = inquiryDates[leadId];
    if (!inquiryDate) continue;

    const inquiryStart = new Date(inquiryDate);

    const acceptedEntry = entries.find((e) => e.new_stage === "accepted");
    if (acceptedEntry) {
      acceptanceDays.push(daysBetween(inquiryStart, new Date(acceptedEntry.changed_at)));
    }

    const enrolledEntry = entries.find((e) => e.new_stage === "enrolled");
    if (enrolledEntry) {
      enrollmentDays.push(daysBetween(inquiryStart, new Date(enrolledEntry.changed_at)));
    }
  }

  const avg = (values: number[]) =>
    values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : null;

  return {
    avgDaysToAcceptance: avg(acceptanceDays),
    avgDaysToEnrollment: avg(enrollmentDays),
    acceptedCount: acceptanceDays.length,
    enrolledCount: enrollmentDays.length,
  };
}
