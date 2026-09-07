import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/**
 * The 48-hour parent reminder.
 *
 * When a family is waiting on US, the pending-decisions page shows it. When WE
 * are waiting on the FAMILY, nothing has ever happened — the lead sits at a
 * stage until somebody notices. 289 leads; 111 of them parked.
 *
 * WHY THIS POLLS INSTEAD OF SCHEDULING.
 * `scheduleApplicationIncompleteReminders` in communications/engine.ts already
 * exists and does the obvious thing: at the moment an application starts, it
 * fires all three reminders into the queue at once. Nothing cancels the later
 * two if the parent finishes on day four — they are already queued, and they
 * will arrive. This module instead holds STATE in admissions_parent_reminders
 * (migration 294) and recomputes the real world on every run. A family that has
 * done the thing is resolved and hears nothing more. Nothing is ever queued
 * before the night it is due.
 *
 * WHY NOT ON THE DECISION GATES. admissions_decision_gates has notify_count and
 * notified_at, which look like exactly the right fields, and are not: all three
 * gates ask a SCHOOL LEADER a question. Reusing them would have chased you.
 */

/** 48 hours, in milliseconds. The one place this number is written down. */
const REMINDER_INTERVAL_MS = 48 * 60 * 60 * 1000;

/** Three reminders, then a human. */
const MAX_REMINDERS = 3;

/** Nothing is sent for a lead that has already left the pipeline. */
const TERMINAL_STAGES = new Set([
  "enrolled",
  "declined",
  "not_returning",
  "waitlisted",
]);

export type ParentWaitKey =
  | "application_not_started"
  | "application_not_submitted"
  | "shadow_days_not_scheduled"
  | "enrollment_not_completed";

const WAIT_TEMPLATE_KEY: Record<ParentWaitKey, string> = {
  application_not_started: "parent_reminder_application_not_started",
  application_not_submitted: "parent_reminder_application_not_submitted",
  shadow_days_not_scheduled: "parent_reminder_shadow_days_not_scheduled",
  enrollment_not_completed: "parent_reminder_enrollment_not_completed",
};

const ESCALATION_TEMPLATE_KEY = "staff_parent_unresponsive";

export interface ParentReminderRunSummary {
  readonly opened: number;
  readonly resolved: number;
  readonly remindersSent: number;
  readonly escalated: number;
  /** Leads in a wait with no usable email. Reported, never silently dropped. */
  readonly skippedNoEmail: number;
  readonly errors: string[];
}

interface LeadRow {
  id: string;
  school_id: string;
  lead_stage: string | null;
  guardian_email: string | null;
}

interface OpenReminderRow {
  id: string;
  lead_id: string;
  wait_key: string;
  waiting_since: string;
  reminders_sent: number;
  last_reminded_at: string | null;
}

/**
 * Work out, from live data, which lead is currently waiting on which of the
 * four things. This is the whole design: it is recomputed every run, so the
 * answer is never stale and a completed step stops the chase immediately.
 */
async function currentWaits(
  supabase: AuthClient,
  leads: LeadRow[]
): Promise<Map<ParentWaitKey, Set<string>>> {
  const leadIds = leads.map((l) => l.id);
  const waits = new Map<ParentWaitKey, Set<string>>([
    ["application_not_started", new Set()],
    ["application_not_submitted", new Set()],
    ["shadow_days_not_scheduled", new Set()],
    ["enrollment_not_completed", new Set()],
  ]);
  if (!leadIds.length) return waits;

  const [gatesResult, appsResult, packetsResult] = await Promise.all([
    supabase
      .from("admissions_decision_gates")
      .select("lead_id, gate_key, answer, status")
      .in("lead_id", leadIds)
      .eq("status", "answered"),
    supabase
      .from("admissions_applications")
      .select("id, lead_id, submitted_at")
      .in("lead_id", leadIds),
    supabase
      .from("enrollment_packets")
      .select("lead_id, packet_status")
      .in("lead_id", leadIds),
  ]);

  // A refused read returns no rows, which here would read as "nobody is
  // waiting on anything" and quietly stop every reminder in the system. Say so
  // instead.
  if (gatesResult.error) throw new Error(`gates: ${gatesResult.error.message}`);
  if (appsResult.error) throw new Error(`applications: ${appsResult.error.message}`);
  if (packetsResult.error) throw new Error(`packets: ${packetsResult.error.message}`);

  const invitedToApply = new Set<string>();
  const invitedToShadow = new Set<string>();
  for (const g of gatesResult.data ?? []) {
    if (g.answer !== "yes") continue;
    if (g.gate_key === "invite_to_apply") invitedToApply.add(g.lead_id as string);
    if (g.gate_key === "invite_to_shadow_days") invitedToShadow.add(g.lead_id as string);
  }

  const hasApplication = new Set<string>();
  const unsubmitted = new Set<string>();
  for (const a of appsResult.data ?? []) {
    hasApplication.add(a.lead_id as string);
    if (!a.submitted_at) unsubmitted.add(a.lead_id as string);
  }

  const completedPacket = new Set<string>();
  for (const p of packetsResult.data ?? []) {
    if (p.packet_status === "completed") completedPacket.add(p.lead_id as string);
  }

  for (const lead of leads) {
    const stage = lead.lead_stage ?? "";
    if (TERMINAL_STAGES.has(stage)) continue;

    // 1. We invited them to apply and no application exists at all.
    if (invitedToApply.has(lead.id) && !hasApplication.has(lead.id)) {
      waits.get("application_not_started")!.add(lead.id);
    }

    // 2. They started one and never sent it.
    if (unsubmitted.has(lead.id)) {
      waits.get("application_not_submitted")!.add(lead.id);
    }

    // 3. We invited them to shadow days and nothing is in the diary. The stage
    //    is the signal here, because booking is what moves it.
    if (
      invitedToShadow.has(lead.id) &&
      stage !== "shadow_day_scheduled" &&
      stage !== "shadow_day_completed" &&
      stage !== "accepted"
    ) {
      waits.get("shadow_days_not_scheduled")!.add(lead.id);
    }

    // 4. Accepted, paperwork unfinished. A missing packet counts: the family
    //    still has something to do either way.
    if (stage === "accepted" && !completedPacket.has(lead.id)) {
      waits.get("enrollment_not_completed")!.add(lead.id);
    }
  }

  return waits;
}

/** Queue one email. The existing communication engine does the sending. */
async function enqueue(
  supabase: AuthClient,
  params: {
    leadId: string;
    schoolId: string;
    templateKey: string;
    templatesBySchool: Map<string, Map<string, { id: string; trigger_event: string; channel: string }>>;
  }
): Promise<boolean> {
  const template = params.templatesBySchool.get(params.schoolId)?.get(params.templateKey);
  // A template missing for THIS school is the exact failure that made
  // staff_application_submitted look broken — the row existed, just not where
  // the lead was. Return false and let the caller count it.
  if (!template) return false;

  const { error } = await supabase.from("admissions_communication_queue").insert({
    lead_id: params.leadId,
    application_id: null,
    template_id: template.id,
    template_key: params.templateKey,
    trigger_event: template.trigger_event,
    channel: template.channel,
    scheduled_for: new Date().toISOString(),
    status: "pending",
  });
  return !error;
}

export async function processParentReminders(): Promise<ParentReminderRunSummary> {
  // THIS JOB RUNS AS THE SERVICE ROLE, WHOEVER TRIGGERED IT.
  //
  // The caller's client is deliberately ignored. Two reasons, both learned the
  // hard way on 6 September:
  //
  // 1. admissions_parent_reminders (294) has a read policy and NO insert
  //    policy -- by design, because the only writer was meant to be this job.
  //    But processAllPlatformQueues is handed a COOKIE client by
  //    /dashboard/admissions/automation, and every insert was silently refused
  //    by RLS. The errors were collected; that page discards the summary.
  //
  // 2. Even where it would work, chasing families should not depend on WHO
  //    loaded a page. A job whose output varies with the trigger's row
  //    visibility is the same class of bug as the cron that authenticated as
  //    nobody: it looks like it ran, and it did nothing.
  const supabase = createServiceRoleClient() as unknown as AuthClient;
  const errors: string[] = [];
  let opened = 0;
  let resolved = 0;
  let remindersSent = 0;
  let escalated = 0;
  let skippedNoEmail = 0;

  const [leadsResult, openResult, templatesResult] = await Promise.all([
    supabase
      .from("admissions_leads")
      .select("id, school_id, lead_stage, guardian_email"),
    supabase
      .from("admissions_parent_reminders")
      .select("id, lead_id, wait_key, waiting_since, reminders_sent, last_reminded_at")
      .is("resolved_at", null)
      .is("escalated_at", null),
    supabase
      .from("admissions_communication_templates")
      .select("id, school_id, template_key, trigger_event, channel, is_active"),
  ]);

  if (leadsResult.error) {
    return {
      opened: 0, resolved: 0, remindersSent: 0, escalated: 0, skippedNoEmail: 0,
      errors: [`Could not read leads: ${leadsResult.error.message}`],
    };
  }
  if (openResult.error) {
    return {
      opened: 0, resolved: 0, remindersSent: 0, escalated: 0, skippedNoEmail: 0,
      errors: [`Could not read open reminders: ${openResult.error.message}`],
    };
  }
  if (templatesResult.error) {
    return {
      opened: 0, resolved: 0, remindersSent: 0, escalated: 0, skippedNoEmail: 0,
      errors: [`Could not read templates: ${templatesResult.error.message}`],
    };
  }

  const leads = (leadsResult.data ?? []) as LeadRow[];
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const openRows = (openResult.data ?? []) as OpenReminderRow[];

  const templatesBySchool = new Map<
    string,
    Map<string, { id: string; trigger_event: string; channel: string }>
  >();
  for (const t of templatesResult.data ?? []) {
    if (!t.is_active) continue;
    const schoolId = t.school_id as string;
    const forSchool = templatesBySchool.get(schoolId) ?? new Map();
    forSchool.set(t.template_key as string, {
      id: t.id as string,
      trigger_event: t.trigger_event as string,
      channel: t.channel as string,
    });
    templatesBySchool.set(schoolId, forSchool);
  }

  let waits: Map<ParentWaitKey, Set<string>>;
  try {
    waits = await currentWaits(supabase, leads);
  } catch (e) {
    return {
      opened: 0, resolved: 0, remindersSent: 0, escalated: 0, skippedNoEmail: 0,
      errors: [e instanceof Error ? e.message : String(e)],
    };
  }

  const openByKey = new Map<string, OpenReminderRow>();
  for (const row of openRows) openByKey.set(`${row.lead_id}:${row.wait_key}`, row);

  // --- 1. Close anything the family has since done. Before sending, so a
  //        family who acted yesterday cannot be chased tonight.
  for (const row of openRows) {
    const stillWaiting = waits.get(row.wait_key as ParentWaitKey)?.has(row.lead_id) ?? false;
    if (stillWaiting) continue;

    const lead = leadById.get(row.lead_id);
    const resolution = lead && TERMINAL_STAGES.has(lead.lead_stage ?? "")
      ? "stage_moved"
      : "completed";

    const { error } = await supabase
      .from("admissions_parent_reminders")
      .update({ resolved_at: new Date().toISOString(), resolution, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) errors.push(`resolve ${row.id}: ${error.message}`);
    else resolved += 1;
  }

  // --- 2. Open a row for anything newly being waited on.
  //        waiting_since is NOW, never the stage date. 111 families have been
  //        parked for months; backdating would fire three reminders and an
  //        escalation at all of them on the first night.
  const nowIso = new Date().toISOString();
  for (const [waitKey, leadIds] of waits) {
    for (const leadId of leadIds) {
      if (openByKey.has(`${leadId}:${waitKey}`)) continue;
      const { error } = await supabase.from("admissions_parent_reminders").insert({
        lead_id: leadId,
        wait_key: waitKey,
        waiting_since: nowIso,
        reminders_sent: 0,
      });
      // A unique violation here means a resolved row already exists for this
      // pair — the family did the thing, then fell back out of it. Not an
      // error worth waking anyone for, but not silently ignored either.
      if (error) {
        if (!error.message.includes("duplicate key")) {
          errors.push(`open ${leadId}/${waitKey}: ${error.message}`);
        }
        continue;
      }
      opened += 1;
    }
  }

  // --- 3. Send what is due. At most one message per row per run.
  const now = Date.now();
  for (const row of openRows) {
    const stillWaiting = waits.get(row.wait_key as ParentWaitKey)?.has(row.lead_id) ?? false;
    if (!stillWaiting) continue;

    const since = row.last_reminded_at ?? row.waiting_since;
    const dueAt = new Date(since).getTime() + REMINDER_INTERVAL_MS;
    if (now < dueAt) continue;

    const lead = leadById.get(row.lead_id);
    if (!lead) continue;

    if (row.reminders_sent >= MAX_REMINDERS) {
      // Three reminders, no answer. Hand it to a person, with the phone number
      // in the email so they do not have to go and find it.
      const sent = await enqueue(supabase, {
        leadId: row.lead_id,
        schoolId: lead.school_id,
        templateKey: ESCALATION_TEMPLATE_KEY,
        templatesBySchool,
      });
      if (!sent) {
        errors.push(`no ${ESCALATION_TEMPLATE_KEY} template for school ${lead.school_id}`);
        continue;
      }
      const { error } = await supabase
        .from("admissions_parent_reminders")
        .update({ escalated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) errors.push(`escalate ${row.id}: ${error.message}`);
      else escalated += 1;
      continue;
    }

    // No address, no email. Counted, because a family nobody can reach is a
    // thing to fix, not a row to skip quietly.
    if (!lead.guardian_email || !lead.guardian_email.includes("@")) {
      skippedNoEmail += 1;
      continue;
    }

    const sent = await enqueue(supabase, {
      leadId: row.lead_id,
      schoolId: lead.school_id,
      templateKey: WAIT_TEMPLATE_KEY[row.wait_key as ParentWaitKey],
      templatesBySchool,
    });
    if (!sent) {
      errors.push(
        `no ${WAIT_TEMPLATE_KEY[row.wait_key as ParentWaitKey]} template for school ${lead.school_id}`
      );
      continue;
    }

    const { error } = await supabase
      .from("admissions_parent_reminders")
      .update({
        reminders_sent: row.reminders_sent + 1,
        last_reminded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) errors.push(`increment ${row.id}: ${error.message}`);
    else remindersSent += 1;
  }

  return { opened, resolved, remindersSent, escalated, skippedNoEmail, errors };
}
