import { createAuthClient } from "@/lib/supabase/server-auth";
import type {
  CommunicationRecord,
  CommunicationTemplate,
  QueuedCommunication,
} from "@/lib/admissions/communications/types";

export interface ApplicantTimelineEntry {
  id: string;
  type: "communication" | "note" | "stage" | "decision";
  channel?: string;
  title: string;
  body: string;
  timestamp: string;
  sentBy?: string | null;
  deliveryStatus?: string;
  openStatus?: string;
  templateKey?: string | null;
}

export async function getLeadCommunications(leadId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_communications")
    .select("*, users(full_name)")
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: false });

  return (data ?? []) as CommunicationRecord[];
}

export async function getApplicantTimeline(leadId: string): Promise<ApplicantTimelineEntry[]> {
  const supabase = await createAuthClient();

  const [communications, notes, history, decisions] = await Promise.all([
    supabase
      .from("admissions_communications")
      .select("*, users(full_name)")
      .eq("lead_id", leadId),
    supabase
      .from("admissions_notes")
      .select("*, users(full_name)")
      .eq("lead_id", leadId),
    supabase
      .from("admissions_lead_stage_history")
      .select("*, users(full_name)")
      .eq("lead_id", leadId),
    supabase.from("admissions_decisions").select("*, users(full_name)").eq("lead_id", leadId),
  ]);

  const entries: ApplicantTimelineEntry[] = [];

  for (const c of communications.data ?? []) {
    entries.push({
      id: c.id,
      type: "communication",
      channel: c.communication_type,
      title: c.subject,
      body: c.body,
      timestamp: c.sent_at,
      sentBy: c.users?.full_name ?? null,
      deliveryStatus: c.delivery_status,
      openStatus: c.open_status,
      templateKey: c.template_key,
    });
  }

  for (const n of notes.data ?? []) {
    entries.push({
      id: n.id,
      type: "note",
      title: "Internal Note",
      body: n.note_text,
      timestamp: n.created_at,
      sentBy: n.users?.full_name ?? null,
    });
  }

  for (const h of history.data ?? []) {
    entries.push({
      id: h.id,
      type: "stage",
      title: `Stage: ${(h.new_stage as string).replace(/_/g, " ")}`,
      body: h.previous_stage
        ? `From ${(h.previous_stage as string).replace(/_/g, " ")}`
        : "Initial stage",
      timestamp: h.changed_at,
      sentBy: h.users?.full_name ?? null,
    });
  }

  for (const d of decisions.data ?? []) {
    entries.push({
      id: d.id,
      type: "decision",
      title: `Decision: ${(d.decision_type as string).replace(/_/g, " ")}`,
      body: d.decision_notes ?? d.email_subject ?? "",
      timestamp: d.decided_at,
      sentBy: d.users?.full_name ?? null,
    });
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function getCommunicationTemplates(schoolId?: string) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("admissions_communication_templates")
    .select("*")
    .order("trigger_event")
    .order("channel");

  if (schoolId) {
    query = query.or(`school_id.is.null,school_id.eq.${schoolId}`);
  }

  const { data } = await query;
  return (data ?? []) as CommunicationTemplate[];
}

export async function getPendingQueue(leadId?: string) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("admissions_communication_queue")
    .select("*")
    .eq("status", "pending")
    .order("scheduled_for");

  if (leadId) query = query.eq("lead_id", leadId);

  const { data } = await query;
  return (data ?? []) as QueuedCommunication[];
}

export async function getStaffNotifications(userId: string, unreadOnly = true) {
  const supabase = await createAuthClient();
  let query = supabase
    .from("admissions_staff_notifications")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (unreadOnly) query = query.is("read_at", null);

  const { data } = await query;
  return data ?? [];
}

export async function getPortalNotifications(leadId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_portal_notifications")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return data ?? [];
}
