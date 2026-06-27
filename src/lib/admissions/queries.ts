import { createAuthClient } from "@/lib/supabase/server-auth";
import { LEAD_STAGES } from "@/lib/constants/admissions";
import { aggregateFundingReporting, fetchLeadFundingCodesByLeadIds } from "@/lib/funding/sync";
import {
  computePipelineVelocity,
  computeStageDurationStats,
  type StageHistoryEntry,
} from "@/lib/admissions/workflow";

export interface AdmissionLead {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  current_grade: string | null;
  applying_for_grade: string | null;
  program: string | null;
  funding_sources: string[];
  referral_source: string | null;
  inquiry_date: string;
  lead_stage: string;
  stage_entered_at: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  notes: string | null;
  created_at: string;
  schools?: { name: string } | null;
}

export interface AdmissionNote {
  id: string;
  lead_id: string;
  note_text: string;
  created_at: string;
  created_by: string | null;
  users?: { full_name: string | null } | null;
}

export interface AdmissionTask {
  id: string;
  lead_id: string;
  task_name: string;
  due_date: string | null;
  task_status: string;
  completed_at: string | null;
  created_at: string;
}

export interface AdmissionTour {
  id: string;
  lead_id: string;
  scheduled_at: string;
  tour_type: string;
  tour_status: string;
  notes: string | null;
  campuses?: { name: string } | null;
}

export type { StageHistoryEntry };

function mapLead(row: Record<string, unknown>, fundingSources: string[]): AdmissionLead {
  return {
    ...(row as Omit<AdmissionLead, "funding_sources">),
    funding_sources: fundingSources,
  };
}

export async function getLeads() {
  const supabase = await createAuthClient();
  const { data, error } = await supabase
    .from("admissions_leads")
    .select("*, schools(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admissions] getLeads:", error.message);
    return [];
  }

  const rows = data ?? [];
  const fundingByLeadId = await fetchLeadFundingCodesByLeadIds(
    supabase,
    rows.map((row) => row.id)
  );

  return rows.map((row) =>
    mapLead(row as Record<string, unknown>, fundingByLeadId.get(row.id) ?? [])
  );
}

export async function getLeadById(id: string) {
  const supabase = await createAuthClient();
  const { data, error } = await supabase
    .from("admissions_leads")
    .select("*, schools(name)")
    .eq("id", id)
    .single();

  if (error) return null;

  const fundingByLeadId = await fetchLeadFundingCodesByLeadIds(supabase, [id]);
  return mapLead(data as Record<string, unknown>, fundingByLeadId.get(id) ?? []);
}

export async function getLeadNotes(leadId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_notes")
    .select("*, users(full_name)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return (data ?? []) as AdmissionNote[];
}

export async function getLeadTasks(leadId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_tasks")
    .select("*")
    .eq("lead_id", leadId)
    .order("due_date", { ascending: true });

  return (data ?? []) as AdmissionTask[];
}

export async function getLeadTours(leadId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_tours")
    .select("*, campuses(name)")
    .eq("lead_id", leadId)
    .order("scheduled_at", { ascending: false });

  return (data ?? []) as AdmissionTour[];
}

export async function getLeadStageHistory(leadId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_lead_stage_history")
    .select("*, users(full_name)")
    .eq("lead_id", leadId)
    .order("changed_at", { ascending: false });

  return (data ?? []) as StageHistoryEntry[];
}

async function getAllStageHistory() {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_lead_stage_history")
    .select("*")
    .order("changed_at", { ascending: true });

  return (data ?? []) as StageHistoryEntry[];
}

export async function getAdmissionsReporting() {
  const [leads, history] = await Promise.all([getLeads(), getAllStageHistory()]);

  const stageLabels = Object.fromEntries(LEAD_STAGES.map((s) => [s.value, s.label]));

  const byStage = LEAD_STAGES.map((stage) => ({
    stage: stage.label,
    value: stage.value,
    count: leads.filter((l) => l.lead_stage === stage.value).length,
  }));

  const byProgram = leads.reduce<Record<string, number>>((acc, lead) => {
    const key = lead.program ?? "unassigned";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const fundingReport = aggregateFundingReporting(
    leads.map((lead) => ({ funding_sources: lead.funding_sources }))
  );

  const avgDaysByStage = computeStageDurationStats(history, leads, stageLabels);

  const inquiryDates = Object.fromEntries(leads.map((l) => [l.id, l.inquiry_date]));
  const velocity = computePipelineVelocity(history, inquiryDates);

  return {
    total: leads.length,
    enrolled: leads.filter((l) => l.lead_stage === "enrolled").length,
    accepted: leads.filter((l) => l.lead_stage === "accepted").length,
    inPipeline: leads.filter((l) => !["enrolled", "declined"].includes(l.lead_stage)).length,
    byStage,
    byProgram,
    byFunding: fundingReport.byFunding,
    byCategory: fundingReport.byCategory,
    avgDaysByStage,
    velocity,
  };
}

export async function getSchools() {
  const supabase = await createAuthClient();
  const { data } = await supabase.from("schools").select("id, name").order("name");
  return data ?? [];
}

export async function getCampuses() {
  const supabase = await createAuthClient();
  const { data } = await supabase.from("campuses").select("id, name, school_id").order("name");
  return data ?? [];
}
