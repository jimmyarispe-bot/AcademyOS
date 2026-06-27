import type { LeadStageValue } from "@/lib/constants/admissions";
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

async function createAutomatedTask(
  supabase: AuthClient,
  leadId: string,
  taskName: string,
  dueDate: string
) {
  await supabase.from("admissions_tasks").insert({
    lead_id: leadId,
    task_name: taskName,
    due_date: dueDate,
    task_status: "open",
  });
}

export async function createStageAutomatedTasks(
  supabase: AuthClient,
  leadId: string,
  newStage: LeadStageValue,
  options?: { tourScheduledAt?: string }
) {
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
      await createAutomatedTask(
        supabase,
        leadId,
        "Tour reminder — contact family",
        formatDateISO(addDays(tourDate, -1))
      );
    }
    return;
  }

  const config = STANDARD_AUTOMATED_TASKS[newStage];
  if (!config) return;

  await createAutomatedTask(
    supabase,
    leadId,
    config.taskName,
    formatDateISO(addDays(new Date(), config.dueDays))
  );
}

export async function transitionLeadStage(
  supabase: AuthClient,
  leadId: string,
  newStage: LeadStageValue,
  changedBy: string | null,
  options?: { tourScheduledAt?: string }
): Promise<{ error?: string; success?: boolean }> {
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

  await createStageAutomatedTasks(supabase, leadId, newStage, options);

  return { success: true };
}

export async function recordInitialStage(
  supabase: AuthClient,
  leadId: string,
  changedBy: string | null
) {
  const now = new Date().toISOString();

  await supabase.from("admissions_lead_stage_history").insert({
    lead_id: leadId,
    previous_stage: null,
    new_stage: "new_inquiry",
    changed_by: changedBy,
    changed_at: now,
  });
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
