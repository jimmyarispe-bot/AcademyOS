import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ComplianceObligation } from "@/lib/compliance/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function buildComplianceIcsFeed(
  supabase: AuthClient,
  schoolId?: string,
  daysAhead = 90
) {
  const end = new Date(Date.now() + daysAhead * 86400000).toISOString().split("T")[0];
  let query = supabase
    .from("compliance_obligations")
    .select("id, title, description, due_date, status, risk_level, school_id")
    .gte("due_date", new Date().toISOString().split("T")[0])
    .lte("due_date", end)
    .not("status", "in", '("completed","archived","cancelled","waived")');

  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return (data ?? []) as Pick<ComplianceObligation, "id" | "title" | "description" | "due_date" | "status" | "risk_level">[];
}

export function obligationsToIcs(
  obligations: Pick<ComplianceObligation, "id" | "title" | "description" | "due_date">[]
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AcademyOS//Compliance Center//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:AcademyOS Compliance Obligations",
  ];

  for (const ob of obligations) {
    const date = ob.due_date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:compliance-${ob.id}@academyos`);
    lines.push(`DTSTART;VALUE=DATE:${date}`);
    lines.push(`DTEND;VALUE=DATE:${date}`);
    lines.push(`SUMMARY:${escapeIcs(ob.title)}`);
    if (ob.description) lines.push(`DESCRIPTION:${escapeIcs(ob.description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function syncObligationToCalendar(
  supabase: AuthClient,
  obligationId: string,
  schoolId: string
) {
  const { data: ob } = await supabase
    .from("compliance_obligations")
    .select("title, description, due_date")
    .eq("id", obligationId)
    .single();

  if (!ob) return;

  let { data: calendar } = await supabase
    .from("academic_calendars")
    .select("id")
    .eq("school_id", schoolId)
    .eq("calendar_scope", "executive")
    .eq("is_active", true)
    .maybeSingle();

  if (!calendar) {
    const { data: created } = await supabase
      .from("academic_calendars")
      .insert({
        school_id: schoolId,
        name: "Compliance & Executive Calendar",
        calendar_scope: "executive",
        is_active: true,
      })
      .select("id")
      .single();
    calendar = created;
  }

  if (!calendar) return;

  const start = `${ob.due_date}T09:00:00`;
  const end = `${ob.due_date}T10:00:00`;

  const { data: event } = await supabase
    .from("academic_calendar_events")
    .insert({
      calendar_id: calendar.id,
      title: `[Compliance] ${ob.title}`,
      description: ob.description,
      starts_at: start,
      ends_at: end,
      event_type: "school_event",
      all_day: true,
      metadata: { compliance_obligation_id: obligationId },
    })
    .select("id")
    .single();

  if (event) {
    await supabase.from("compliance_calendar_links").insert({
      obligation_id: obligationId,
      calendar_id: calendar.id,
      calendar_event_id: event.id,
      calendar_scope: "executive",
    });
  }
}
