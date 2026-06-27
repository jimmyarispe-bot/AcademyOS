import type { createAuthClient } from "@/lib/supabase/server-auth";
import { fetchLeadFundingCodesByLeadIds } from "@/lib/funding/sync";
import type { MergeContext } from "@/lib/admissions/communications/merge-fields";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface WorkflowContext {
  leadId: string;
  applicationId: string | null;
  schoolId: string;
  assignedToUserId: string | null;
  leadStage: string;
  applicationStatus: string | null;
  mergeContext: MergeContext;
  metadata: Record<string, unknown>;
}

export async function buildWorkflowContext(
  supabase: AuthClient,
  leadId: string,
  applicationId?: string | null,
  overrides?: Record<string, unknown>
): Promise<WorkflowContext | null> {
  const { data: lead } = await supabase
    .from("admissions_leads")
    .select("*, schools(name)")
    .eq("id", leadId)
    .single();

  if (!lead?.school_id) return null;

  const fundingByLead = await fetchLeadFundingCodesByLeadIds(supabase, [leadId]);

  let applicationStatus: string | null = null;
  let resolvedApplicationId = applicationId ?? null;

  if (!resolvedApplicationId) {
    const { data: app } = await supabase
      .from("admissions_applications")
      .select("id, application_status")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    resolvedApplicationId = app?.id ?? null;
    applicationStatus = app?.application_status ?? null;
  } else {
    const { data: app } = await supabase
      .from("admissions_applications")
      .select("application_status")
      .eq("id", resolvedApplicationId)
      .maybeSingle();
    applicationStatus = app?.application_status ?? null;
  }

  const { data: tour } = await supabase
    .from("admissions_tours")
    .select("scheduled_at, campuses(name, address)")
    .eq("lead_id", leadId)
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let interviewDatetime: string | null = null;
  const { data: interview } = await supabase
    .from("admissions_interviews")
    .select("scheduled_at")
    .eq("lead_id", leadId)
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (interview?.scheduled_at) {
    interviewDatetime = new Date(interview.scheduled_at).toLocaleString();
  }

  let missingItems: string[] = [];
  if (resolvedApplicationId) {
    const { data: checklist } = await supabase
      .from("admissions_application_checklist_items")
      .select("item_key")
      .eq("application_id", resolvedApplicationId)
      .eq("status", "pending");
    missingItems = (checklist ?? []).map((c) => c.item_key.replace(/_/g, " "));
  }

  const campus = tour?.campuses as { name?: string; address?: string } | null;

  const mergeContext: MergeContext = {
    studentFirstName: lead.first_name,
    studentLastName: lead.last_name,
    preferredName: lead.preferred_name,
    guardianFirstName: lead.guardian_first_name,
    guardianLastName: lead.guardian_last_name,
    guardianEmail: lead.guardian_email,
    guardianPhone: lead.guardian_phone,
    schoolName: (lead.schools as { name?: string } | null)?.name ?? null,
    program: lead.program,
    campusName: campus?.name ?? null,
    campusAddress: campus?.address ?? null,
    fundingSources: fundingByLead.get(leadId) ?? [],
    applicationId: resolvedApplicationId,
    leadId,
    tourDatetime: tour?.scheduled_at
      ? new Date(tour.scheduled_at).toLocaleString()
      : null,
    interviewDatetime,
    missingItems,
    ...(overrides as Partial<MergeContext>),
  };

  return {
    leadId,
    applicationId: resolvedApplicationId,
    schoolId: lead.school_id,
    assignedToUserId: lead.assigned_to_user_id ?? null,
    leadStage: lead.lead_stage,
    applicationStatus,
    mergeContext,
    metadata: overrides ?? {},
  };
}
