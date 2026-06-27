import type { createAuthClient } from "@/lib/supabase/server-auth";
import { fetchLeadFundingCodesByLeadIds } from "@/lib/funding/sync";
import { renderTemplate, type MergeContext } from "@/lib/admissions/communications/merge-fields";
import { adjustScheduledForBusinessHours } from "@/lib/platform/automation/business-hours";
import type {
  CommunicationChannel,
  CommunicationTemplate,
  CommunicationTriggerEvent,
} from "@/lib/admissions/communications/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface TriggerCommunicationsOptions {
  leadId: string;
  applicationId?: string | null;
  triggerEvent: CommunicationTriggerEvent;
  mergeOverrides?: Partial<MergeContext>;
  sentBy?: string | null;
  skipQueue?: boolean;
}

async function resolveScheduledFor(
  supabase: AuthClient,
  schoolId: string,
  target: Date
): Promise<string> {
  const adjusted = await adjustScheduledForBusinessHours(supabase, schoolId, target);
  return adjusted.toISOString();
}

async function loadMergeContext(
  supabase: AuthClient,
  leadId: string,
  applicationId?: string | null,
  overrides?: Partial<MergeContext>
): Promise<MergeContext> {
  const { data: lead } = await supabase
    .from("admissions_leads")
    .select("*, schools(name)")
    .eq("id", leadId)
    .single();

  if (!lead) throw new Error("Lead not found");

  const fundingByLead = await fetchLeadFundingCodesByLeadIds(supabase, [leadId]);

  let tourDatetime: string | null = null;
  let campusName: string | null = null;
  let campusAddress: string | null = null;

  const { data: tour } = await supabase
    .from("admissions_tours")
    .select("scheduled_at, campuses(name, address)")
    .eq("lead_id", leadId)
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tour) {
    tourDatetime = new Date(tour.scheduled_at).toLocaleString();
    const campus = tour.campuses as { name?: string; address?: string } | null;
    campusName = campus?.name ?? null;
    campusAddress = campus?.address ?? null;
  }

  let missingItems: string[] = [];
  if (applicationId) {
    const { data: checklist } = await supabase
      .from("admissions_application_checklist_items")
      .select("item_key, status")
      .eq("application_id", applicationId)
      .eq("status", "pending");

    missingItems = (checklist ?? []).map((c) => c.item_key.replace(/_/g, " "));
  }

  return {
    studentFirstName: lead.first_name,
    studentLastName: lead.last_name,
    preferredName: lead.preferred_name,
    guardianFirstName: lead.guardian_first_name,
    guardianLastName: lead.guardian_last_name,
    guardianEmail: lead.guardian_email,
    guardianPhone: lead.guardian_phone,
    schoolName: (lead.schools as { name?: string } | null)?.name ?? null,
    program: lead.program,
    campusName,
    campusAddress,
    fundingSources: fundingByLead.get(leadId) ?? [],
    applicationId: applicationId ?? null,
    leadId,
    tourDatetime,
    missingItems,
    ...overrides,
  };
}

async function getTemplatesForTrigger(
  supabase: AuthClient,
  schoolId: string,
  triggerEvent: CommunicationTriggerEvent
): Promise<CommunicationTemplate[]> {
  const { data } = await supabase
    .from("admissions_communication_templates")
    .select("*")
    .eq("trigger_event", triggerEvent)
    .eq("is_active", true)
    .or(`school_id.is.null,school_id.eq.${schoolId}`);

  const templates = (data ?? []) as CommunicationTemplate[];

  const byKey = new Map<string, CommunicationTemplate>();
  for (const t of templates.sort((a, b) => (a.school_id ? 1 : 0) - (b.school_id ? 1 : 0))) {
    byKey.set(t.template_key, t);
  }
  return [...byKey.values()];
}

async function deliverCommunication(
  supabase: AuthClient,
  params: {
    leadId: string;
    applicationId: string | null;
    template: CommunicationTemplate;
    mergeCtx: MergeContext;
    sentBy: string | null;
    customSubject?: string | null;
    customBody?: string | null;
  }
) {
  const subject = renderTemplate(
    params.customSubject ?? params.template.subject,
    params.mergeCtx
  );
  const body = renderTemplate(params.customBody ?? params.template.body, params.mergeCtx);
  const channel = params.template.channel as CommunicationChannel;
  const isStaff = channel === "internal_note" || params.template.trigger_event.startsWith("staff_");

  const sentTo =
    channel === "sms"
      ? params.mergeCtx.guardianPhone ?? ""
      : channel === "internal_note"
        ? "staff"
        : params.mergeCtx.guardianEmail ?? "";

  const { data: comm, error } = await supabase
    .from("admissions_communications")
    .insert({
      lead_id: params.leadId,
      application_id: params.applicationId,
      communication_type: channel,
      subject,
      body,
      sent_to: sentTo,
      sent_by: params.sentBy,
      template_id: params.template.id,
      template_key: params.template.template_key,
      trigger_event: params.template.trigger_event,
      delivery_status: channel === "email" || channel === "sms" ? "logged" : "sent",
      open_status: "unknown",
      recipient_phone: channel === "sms" ? sentTo : null,
      is_staff_notification: isStaff,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[communications] deliver:", error.message);
    return null;
  }

  if (channel === "portal_notification") {
    await supabase.from("admissions_portal_notifications").insert({
      lead_id: params.leadId,
      application_id: params.applicationId,
      title: subject,
      body,
    });
  }

  if (isStaff) {
    const { data: lead } = await supabase
      .from("admissions_leads")
      .select("school_id, assigned_to_user_id")
      .eq("id", params.leadId)
      .single();

    if (lead?.school_id) {
      await supabase.from("admissions_staff_notifications").insert({
        user_id: lead.assigned_to_user_id,
        school_id: lead.school_id,
        lead_id: params.leadId,
        application_id: params.applicationId,
        notification_type: params.template.trigger_event,
        title: subject,
        body,
      });
    }
  }

  return comm?.id ?? null;
}

export async function triggerCommunications(
  supabase: AuthClient,
  options: TriggerCommunicationsOptions
) {
  const { data: lead } = await supabase
    .from("admissions_leads")
    .select("school_id")
    .eq("id", options.leadId)
    .single();

  if (!lead?.school_id) return;

  const mergeCtx = await loadMergeContext(
    supabase,
    options.leadId,
    options.applicationId,
    options.mergeOverrides
  );

  const templates = await getTemplatesForTrigger(
    supabase,
    lead.school_id,
    options.triggerEvent
  );

  for (const template of templates) {
    if (template.delay_hours > 0 && !options.skipQueue) {
      const target = new Date(Date.now() + template.delay_hours * 60 * 60 * 1000);
      const scheduledFor = await resolveScheduledFor(supabase, lead.school_id, target);

      await supabase.from("admissions_communication_queue").insert({
        lead_id: options.leadId,
        application_id: options.applicationId ?? null,
        template_id: template.id,
        template_key: template.template_key,
        trigger_event: template.trigger_event,
        channel: template.channel,
        scheduled_for: scheduledFor,
        status: "pending",
      });
      continue;
    }

    await deliverCommunication(supabase, {
      leadId: options.leadId,
      applicationId: options.applicationId ?? null,
      template,
      mergeCtx,
      sentBy: options.sentBy ?? null,
    });
  }
}

export async function processCommunicationQueue(supabase: AuthClient) {
  const now = new Date().toISOString();

  const { data: pending } = await supabase
    .from("admissions_communication_queue")
    .select("*, admissions_communication_templates(*)")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .limit(50);

  for (const item of pending ?? []) {
    const template = item.admissions_communication_templates as CommunicationTemplate | null;
    if (!template) {
      await supabase
        .from("admissions_communication_queue")
        .update({ status: "failed" })
        .eq("id", item.id);
      continue;
    }

    const mergeCtx = await loadMergeContext(
      supabase,
      item.lead_id,
      item.application_id
    );

    const commId = await deliverCommunication(supabase, {
      leadId: item.lead_id,
      applicationId: item.application_id,
      template,
      mergeCtx,
      sentBy: null,
      customSubject: item.custom_subject,
      customBody: item.custom_body,
    });

    await supabase
      .from("admissions_communication_queue")
      .update({
        status: commId ? "sent" : "failed",
        sent_communication_id: commId,
      })
      .eq("id", item.id);
  }
}

export async function scheduleTourReminders(
  supabase: AuthClient,
  leadId: string,
  tourScheduledAt: string
) {
  const tourDate = new Date(tourScheduledAt);
  const reminders: { event: CommunicationTriggerEvent; hoursBefore: number }[] = [
    { event: "tour_reminder_24h", hoursBefore: 24 },
    { event: "tour_reminder_2h", hoursBefore: 2 },
  ];

  const { data: lead } = await supabase
    .from("admissions_leads")
    .select("school_id")
    .eq("id", leadId)
    .single();

  if (!lead?.school_id) return;

  for (const { event, hoursBefore } of reminders) {
    const templates = await getTemplatesForTrigger(supabase, lead.school_id, event);
    for (const template of templates) {
      const target = new Date(tourDate.getTime() - hoursBefore * 60 * 60 * 1000);
      if (target <= new Date()) continue;

      const scheduledFor = await resolveScheduledFor(supabase, lead.school_id, target);

      await supabase.from("admissions_communication_queue").insert({
        lead_id: leadId,
        template_id: template.id,
        template_key: template.template_key,
        trigger_event: event,
        channel: template.channel,
        scheduled_for: scheduledFor,
        status: "pending",
      });
    }
  }
}

export async function scheduleApplicationIncompleteReminders(
  supabase: AuthClient,
  leadId: string,
  applicationId: string
) {
  const delays: CommunicationTriggerEvent[] = [
    "application_incomplete_3d",
    "application_incomplete_7d",
    "application_incomplete_14d",
  ];

  for (const event of delays) {
    await triggerCommunications(supabase, {
      leadId,
      applicationId,
      triggerEvent: event,
      sentBy: null,
    });
  }
}
