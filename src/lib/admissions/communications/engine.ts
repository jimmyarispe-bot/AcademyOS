import type { createAuthClient } from "@/lib/supabase/server-auth";
import { fetchLeadFundingCodesByLeadIds } from "@/lib/funding/sync";
import { resolveSchoolAdmissionsContacts } from "@/lib/admissions/communications/staff-recipients";
import { renderTemplate, type MergeContext } from "@/lib/admissions/communications/merge-fields";
import { adjustManyScheduledForBusinessHours } from "@/lib/platform/automation/business-hours";
import { sendTransactionalEmail } from "@/lib/platform/email";
import {
  COMMUNICATION_QUEUE_PROCESS_COLS,
  COMMUNICATION_TEMPLATE_COLS,
  LEAD_MERGE_CONTEXT_COLS,
} from "@/lib/admissions/communications/projections";
import type {
  CommunicationChannel,
  CommunicationTemplate,
  CommunicationTriggerEvent,
} from "@/lib/admissions/communications/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

type LeadMergeRow = {
  id: string;
  school_id: string | null;
  assigned_to_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  program: string | null;
  schools: SchoolContact | SchoolContact[] | null;
};

type SchoolContact = {
  name?: string;
  admissions_contact_name?: string | null;
  admissions_contact_email?: string | null;
  admissions_booking_url?: string | null;
  admissions_from_email?: string | null;
  shadow_days_url?: string | null;
};

type LeadStaffHint = {
  schoolId: string | null;
  assignedToUserId: string | null;
};

export interface TriggerCommunicationsOptions {
  leadId: string;
  applicationId?: string | null;
  triggerEvent: CommunicationTriggerEvent;
  mergeOverrides?: Partial<MergeContext>;
  sentBy?: string | null;
  skipQueue?: boolean;
}

/** PostgREST returns an embedded row as an object or a single-element array. */
function schoolOf(lead: LeadMergeRow): SchoolContact | null {
  const schools = lead.schools;
  if (!schools) return null;
  return (Array.isArray(schools) ? schools[0] : schools) ?? null;
}

function schoolNameFromLead(lead: LeadMergeRow): string | null {
  return schoolOf(lead)?.name ?? null;
}

function clean(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : null;
}

function buildMergeContextFromParts(
  lead: LeadMergeRow,
  fundingSources: string[],
  tour: {
    tourDatetime: string | null;
    campusName: string | null;
    campusAddress: string | null;
  },
  missingItems: string[],
  applicationId?: string | null,
  overrides?: Partial<MergeContext>
): MergeContext {
  return {
    studentFirstName: lead.first_name,
    studentLastName: lead.last_name,
    preferredName: lead.preferred_name,
    guardianFirstName: lead.guardian_first_name,
    guardianLastName: lead.guardian_last_name,
    guardianEmail: lead.guardian_email,
    guardianPhone: lead.guardian_phone,
    schoolName: schoolNameFromLead(lead),
    admissionsContactName: clean(schoolOf(lead)?.admissions_contact_name),
    admissionsContactEmail: clean(schoolOf(lead)?.admissions_contact_email),
    schedulingUrl: clean(schoolOf(lead)?.admissions_booking_url),
    shadowDaysUrl: clean(schoolOf(lead)?.shadow_days_url),
    fromEmail: clean(schoolOf(lead)?.admissions_from_email),
    program: lead.program,
    campusName: tour.campusName,
    campusAddress: tour.campusAddress,
    fundingSources,
    applicationId: applicationId ?? null,
    leadId: lead.id,
    tourDatetime: tour.tourDatetime,
    missingItems,
    ...overrides,
  };
}

async function loadMergeContext(
  supabase: AuthClient,
  leadId: string,
  applicationId?: string | null,
  overrides?: Partial<MergeContext>
): Promise<{ mergeCtx: MergeContext; staff: LeadStaffHint }> {
  const [{ data: lead }, fundingByLead, { data: tour }, checklistRes] = await Promise.all([
    supabase.from("admissions_leads").select(LEAD_MERGE_CONTEXT_COLS).eq("id", leadId).single(),
    fetchLeadFundingCodesByLeadIds(supabase, [leadId]),
    supabase
      .from("admissions_tours")
      .select("scheduled_at, campuses(name, address)")
      .eq("lead_id", leadId)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    applicationId
      ? supabase
          .from("admissions_application_checklist_items")
          .select("item_key, status")
          .eq("application_id", applicationId)
          .eq("status", "pending")
      : Promise.resolve({ data: [] as { item_key: string }[] }),
  ]);

  if (!lead) throw new Error("Lead not found");
  const leadRow = lead as LeadMergeRow;

  let tourDatetime: string | null = null;
  let campusName: string | null = null;
  let campusAddress: string | null = null;
  if (tour) {
    tourDatetime = new Date(tour.scheduled_at).toLocaleString();
    const campus = tour.campuses as { name?: string; address?: string } | null;
    campusName = campus?.name ?? null;
    campusAddress = campus?.address ?? null;
  }

  const missingItems = (checklistRes.data ?? []).map((c) =>
    String(c.item_key).replace(/_/g, " ")
  );

  return {
    mergeCtx: buildMergeContextFromParts(
      leadRow,
      fundingByLead.get(leadId) ?? [],
      { tourDatetime, campusName, campusAddress },
      missingItems,
      applicationId,
      overrides
    ),
    staff: {
      schoolId: leadRow.school_id,
      assignedToUserId: leadRow.assigned_to_user_id,
    },
  };
}

/** P009 — batch merge contexts for queue processing (unique leads / applications). */
async function loadMergeContextsForQueue(
  supabase: AuthClient,
  items: Array<{ lead_id: string; application_id: string | null }>
): Promise<Map<string, { mergeCtx: MergeContext; staff: LeadStaffHint }>> {
  const result = new Map<string, { mergeCtx: MergeContext; staff: LeadStaffHint }>();
  const leadIds = [...new Set(items.map((i) => i.lead_id))];
  if (!leadIds.length) return result;

  const applicationIds = [
    ...new Set(items.map((i) => i.application_id).filter((id): id is string => Boolean(id))),
  ];

  const [{ data: leads }, fundingByLead, { data: tours }, { data: checklist }] =
    await Promise.all([
      supabase.from("admissions_leads").select(LEAD_MERGE_CONTEXT_COLS).in("id", leadIds),
      fetchLeadFundingCodesByLeadIds(supabase, leadIds),
      supabase
        .from("admissions_tours")
        .select("lead_id, scheduled_at, campuses(name, address)")
        .in("lead_id", leadIds)
        .order("scheduled_at", { ascending: false }),
      applicationIds.length
        ? supabase
            .from("admissions_application_checklist_items")
            .select("application_id, item_key, status")
            .in("application_id", applicationIds)
            .eq("status", "pending")
        : Promise.resolve({ data: [] as { application_id: string; item_key: string }[] }),
    ]);

  const leadById = new Map((leads ?? []).map((l) => [l.id as string, l as LeadMergeRow]));

  const latestTourByLead = new Map<
    string,
    { tourDatetime: string | null; campusName: string | null; campusAddress: string | null }
  >();
  for (const tour of tours ?? []) {
    const leadId = tour.lead_id as string;
    if (latestTourByLead.has(leadId)) continue;
    const campus = tour.campuses as { name?: string; address?: string } | null;
    latestTourByLead.set(leadId, {
      tourDatetime: new Date(tour.scheduled_at).toLocaleString(),
      campusName: campus?.name ?? null,
      campusAddress: campus?.address ?? null,
    });
  }

  const missingByApp = new Map<string, string[]>();
  for (const row of checklist ?? []) {
    const appId = row.application_id as string;
    const list = missingByApp.get(appId) ?? [];
    list.push(String(row.item_key).replace(/_/g, " "));
    missingByApp.set(appId, list);
  }

  for (const item of items) {
    const key = `${item.lead_id}:${item.application_id ?? ""}`;
    if (result.has(key)) continue;
    const lead = leadById.get(item.lead_id);
    if (!lead) continue;
    result.set(key, {
      mergeCtx: buildMergeContextFromParts(
        lead,
        fundingByLead.get(item.lead_id) ?? [],
        latestTourByLead.get(item.lead_id) ?? {
          tourDatetime: null,
          campusName: null,
          campusAddress: null,
        },
        item.application_id ? (missingByApp.get(item.application_id) ?? []) : [],
        item.application_id
      ),
      staff: {
        schoolId: lead.school_id,
        assignedToUserId: lead.assigned_to_user_id,
      },
    });
  }

  return result;
}

async function getTemplatesForTrigger(
  supabase: AuthClient,
  schoolId: string,
  triggerEvent: CommunicationTriggerEvent
): Promise<CommunicationTemplate[]> {
  const { data } = await supabase
    .from("admissions_communication_templates")
    .select(COMMUNICATION_TEMPLATE_COLS)
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
    staff?: LeadStaffHint;
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
        : channel === "staff_email"
          ? // Every admissions contact for the campus, not just the one whose
            // calendar parents book. Falls back to the single contact so a
            // school with no rows in school_admissions_contacts still gets mail.
            (params.mergeCtx.staffNotificationEmails ?? []).join(", ") ||
            (params.mergeCtx.admissionsContactEmail ?? "")
          : params.mergeCtx.guardianEmail ?? "";

  const isEmail = channel === "email" || channel === "staff_email";

  let deliveryStatus: string = isEmail || channel === "sms" ? "pending" : "sent";
  let deliveryError: string | null = null;

  if (isEmail && sentTo) {
    /**
     * From a named person at a verified domain; replies go to their real inbox.
     *
     * The From *address* stays the verified sender. Sending as a leader's own
     * @gmail.com would fail SPF and land the school in spam, which is a worse
     * outcome than a noreply address with their name on it. Reply-to carries
     * the actual conversation, which is the part a parent uses.
     *
     * Staff mail replies to the family, so a school leader can answer an
     * inquiry alert without leaving their inbox.
     */
    const contactName = params.mergeCtx.admissionsContactName?.trim();
    const schoolName = params.mergeCtx.schoolName?.trim();
    const fromName =
      channel === "staff_email"
        ? undefined
        : contactName && schoolName
          ? `${contactName} · ${schoolName}`
          : contactName || schoolName || undefined;

    const replyTo =
      channel === "staff_email"
        ? params.mergeCtx.guardianEmail ?? undefined
        : params.mergeCtx.admissionsContactEmail ?? undefined;

    /**
     * The school's own domain when it has one, the network default otherwise.
     *
     * Left absent rather than defaulted here, so an unset school falls through
     * to EMAIL_FROM in one place instead of two. An address on a domain Resend
     * has not verified is rejected outright — which is why the editor tells the
     * operator that before they type it, and why null is the safe state.
     */
    const from = params.mergeCtx.fromEmail?.trim() || undefined;

    const emailResult = await sendTransactionalEmail({
      to: sentTo,
      subject,
      body,
      ...(from ? { from } : {}),
      ...(fromName ? { fromName } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
    deliveryStatus = emailResult.success ? "sent" : "failed";
    deliveryError = emailResult.error ?? null;

    if (!emailResult.success && process.env.NODE_ENV === "production") {
      const { createMissionControlItem } = await import("@/lib/platform/automation/mission-control");
      await createMissionControlItem(supabase, {
        module: "admissions",
        itemType: "admissions_alert",
        title: "Admissions email delivery failed",
        body: deliveryError ?? "Email delivery failed",
        entityType: "admissions_leads",
        entityId: params.leadId,
        severity: "high",
        assignedRole: "ADMISSIONS_DIRECTOR",
        metadata: { triggerEvent: params.template.trigger_event, sentTo },
      });
    }
  } else if (channel === "sms") {
    deliveryStatus = "logged";
    deliveryError = "SMS provider not configured for v1.0";
  }

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
      delivery_status: deliveryStatus,
      open_status: "unknown",
      recipient_phone: channel === "sms" ? sentTo : null,
      is_staff_notification: isStaff,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[communications] deliver:", error.message, deliveryError ?? "");
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
    let schoolId = params.staff?.schoolId ?? null;
    let assignedToUserId = params.staff?.assignedToUserId ?? null;
    if (!schoolId) {
      const { data: lead } = await supabase
        .from("admissions_leads")
        .select("school_id, assigned_to_user_id")
        .eq("id", params.leadId)
        .single();
      schoolId = lead?.school_id ?? null;
      assignedToUserId = lead?.assigned_to_user_id ?? null;
    }

    if (schoolId) {
      await supabase.from("admissions_staff_notifications").insert({
        user_id: assignedToUserId,
        school_id: schoolId,
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
  const loaded = await loadMergeContext(
    supabase,
    options.leadId,
    options.applicationId,
    options.mergeOverrides
  );
  const schoolId = loaded.staff.schoolId;
  if (!schoolId) return;

  /**
   * Who gets told, and whose calendar gets booked — now two questions.
   *
   * Until migration 327 they shared one column on `schools`, so a campus could
   * notify exactly one person. `resolveSchoolAdmissionsContacts` reads the new
   * table and falls back to those columns when it is empty or absent, so the
   * behaviour of a school nobody has configured is unchanged.
   *
   * The booking contact overrides the merge context because a parent's mail is
   * signed by, replies to, and books the calendar of ONE person. The
   * notification list is separate and is used only as the staff recipient.
   */
  const contacts = await resolveSchoolAdmissionsContacts(supabase, schoolId, {
    contactName: loaded.mergeCtx.admissionsContactName,
    contactEmail: loaded.mergeCtx.admissionsContactEmail,
    bookingUrl: loaded.mergeCtx.schedulingUrl,
  });

  loaded.mergeCtx = {
    ...loaded.mergeCtx,
    admissionsContactName: contacts.contactName,
    admissionsContactEmail: contacts.contactEmail,
    schedulingUrl: contacts.bookingUrl,
    staffNotificationEmails: contacts.notificationEmails,
  };

  const allTemplates = await getTemplatesForTrigger(supabase, schoolId, options.triggerEvent);

  /**
   * Two versions of the family's confirmation exist: one that offers the
   * school's booking link, one that promises a person will be in touch. Exactly
   * one is sent, chosen by whether the school actually has a link.
   *
   * This is the guard that matters. `renderTemplate` leaves an unresolved token
   * in place as literal text, so a school with no booking URL would otherwise
   * email a prospective family the characters `{{scheduling_link}}` — the
   * clearest possible signal that nobody is home.
   *
   * A staff alert with no recipient is dropped the same way rather than queued
   * as a delivery to the empty string.
   */
  const hasBookingLink = Boolean(loaded.mergeCtx.schedulingUrl);
  const hasStaffEmail =
    (loaded.mergeCtx.staffNotificationEmails ?? []).length > 0 ||
    Boolean(loaded.mergeCtx.admissionsContactEmail);

  const templates = allTemplates.filter((t) => {
    if (t.template_key === "inquiry_thank_you_email") return hasBookingLink;
    if (t.template_key === "inquiry_thank_you_email_no_link") return !hasBookingLink;
    if (t.channel === "staff_email") return hasStaffEmail;
    return true;
  });

  const delayed = templates.filter((t) => t.delay_hours > 0 && !options.skipQueue);
  const immediate = templates.filter((t) => !(t.delay_hours > 0 && !options.skipQueue));

  if (delayed.length) {
    const targets = delayed.map(
      (template) => new Date(Date.now() + template.delay_hours * 60 * 60 * 1000)
    );
    const adjusted = await adjustManyScheduledForBusinessHours(supabase, schoolId, targets);
    const queueRows = delayed.map((template, index) => ({
      lead_id: options.leadId,
      application_id: options.applicationId ?? null,
      template_id: template.id,
      template_key: template.template_key,
      trigger_event: template.trigger_event,
      channel: template.channel,
      scheduled_for: adjusted[index].toISOString(),
      status: "pending",
    }));
    await supabase.from("admissions_communication_queue").insert(queueRows);
  }

  if (immediate.length) {
    await Promise.all(
      immediate.map((template) =>
        deliverCommunication(supabase, {
          leadId: options.leadId,
          applicationId: options.applicationId ?? null,
          template,
          mergeCtx: loaded.mergeCtx,
          sentBy: options.sentBy ?? null,
          staff: loaded.staff,
        })
      )
    );
  }
}

export async function processCommunicationQueue(supabase: AuthClient) {
  const now = new Date().toISOString();

  const { data: pending } = await supabase
    .from("admissions_communication_queue")
    .select(COMMUNICATION_QUEUE_PROCESS_COLS)
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .limit(50);

  const items = pending ?? [];
  if (!items.length) return;

  const mergeByKey = await loadMergeContextsForQueue(
    supabase,
    items.map((item) => ({
      lead_id: item.lead_id,
      application_id: item.application_id,
    }))
  );

  for (const item of items) {
    const nested = item.admissions_communication_templates as
      | CommunicationTemplate
      | CommunicationTemplate[]
      | null;
    const template = (Array.isArray(nested) ? nested[0] : nested) ?? null;
    if (!template) {
      await supabase
        .from("admissions_communication_queue")
        .update({ status: "failed" })
        .eq("id", item.id);
      continue;
    }

    const packed = mergeByKey.get(`${item.lead_id}:${item.application_id ?? ""}`);
    if (!packed) {
      await supabase
        .from("admissions_communication_queue")
        .update({ status: "failed" })
        .eq("id", item.id);
      continue;
    }

    const commId = await deliverCommunication(supabase, {
      leadId: item.lead_id,
      applicationId: item.application_id,
      template,
      mergeCtx: packed.mergeCtx,
      sentBy: null,
      customSubject: item.custom_subject,
      customBody: item.custom_body,
      staff: packed.staff,
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

  const templateSets = await Promise.all(
    reminders.map(({ event }) => getTemplatesForTrigger(supabase, lead.school_id, event))
  );

  type PendingRow = {
    lead_id: string;
    template_id: string;
    template_key: string;
    trigger_event: CommunicationTriggerEvent;
    channel: string;
    target: Date;
  };

  const pending: PendingRow[] = [];
  for (let i = 0; i < reminders.length; i++) {
    const { event, hoursBefore } = reminders[i];
    const templates = templateSets[i];
    for (const template of templates) {
      const target = new Date(tourDate.getTime() - hoursBefore * 60 * 60 * 1000);
      if (target <= new Date()) continue;
      pending.push({
        lead_id: leadId,
        template_id: template.id,
        template_key: template.template_key,
        trigger_event: event,
        channel: template.channel,
        target,
      });
    }
  }

  if (!pending.length) return;

  const adjusted = await adjustManyScheduledForBusinessHours(
    supabase,
    lead.school_id,
    pending.map((p) => p.target)
  );

  await supabase.from("admissions_communication_queue").insert(
    pending.map((row, index) => ({
      lead_id: row.lead_id,
      template_id: row.template_id,
      template_key: row.template_key,
      trigger_event: row.trigger_event,
      channel: row.channel,
      scheduled_for: adjusted[index].toISOString(),
      status: "pending",
    }))
  );
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

  await Promise.all(
    delays.map((event) =>
      triggerCommunications(supabase, {
        leadId,
        applicationId,
        triggerEvent: event,
        sentBy: null,
      })
    )
  );
}
