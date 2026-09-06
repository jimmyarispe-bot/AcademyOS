/**
 * The children whose shadow days are booked and not yet finished.
 *
 * WHY THIS SCREEN EXISTS.
 *
 * Gate 3 — accept or deny — opens at `shadow_day_completed`. On 6 September
 * 2026, sixteen leads sat at `shadow_day_scheduled` and **not one lead had ever
 * reached `shadow_day_completed`**, because nothing in JAG moves them there.
 * The stage exists, the gate that depends on it exists, and the transition
 * between them was never built.
 *
 * So those sixteen children could not be accepted or denied by any action
 * anybody took. Not a slow queue — an unreachable state. A family whose child
 * has already spent days in the school is waiting on a decision the system
 * cannot ask for.
 *
 * The right end state is that JAG knows the booked date and the stage moves
 * when it passes. It does not know: shadow days are booked in Google Calendar
 * and nothing writes back. Until that exists, a person says when it happened —
 * which is honest, because a person is the only one who currently knows.
 */

import { createAuthClient } from "@/lib/supabase/server-auth";
import type { ShadowDayCase } from "@/lib/admissions/shadow-days-shared";

export type { ShadowDayCase } from "@/lib/admissions/shadow-days-shared";

export async function listShadowDaysInProgress(): Promise<
  { cases: ShadowDayCase[] } | { error: string }
> {
  const supabase = await createAuthClient();

  const { data, error } = await supabase
    .from("admissions_leads")
    .select(
      "id, first_name, last_name, guardian_first_name, guardian_last_name, guardian_email, guardian_phone, current_grade, created_at, archived_at, schools(name)"
    )
    .eq("lead_stage", "shadow_day_scheduled")
    .is("archived_at", null)
    .order("created_at");

  // A refusal returns no rows, and an empty list on this page reads as "nobody
  // is waiting" — the single most misleading thing it could say. Name the
  // failure instead.
  if (error) return { error: `Could not read shadow-day cases: ${error.message}` };

  const today = Date.now();

  const cases: ShadowDayCase[] = (data ?? []).map((row) => {
    const rel = row.schools as { name?: string } | { name?: string }[] | null;
    const schoolName =
      (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? null;

    const guardian = [row.guardian_first_name, row.guardian_last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    const created = row.created_at as string;

    return {
      leadId: row.id as string,
      studentName:
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        "(unnamed student)",
      guardianName: guardian || null,
      guardianEmail: (row.guardian_email as string | null) ?? null,
      guardianPhone: (row.guardian_phone as string | null) ?? null,
      schoolName,
      grade: (row.current_grade as string | null) ?? null,
      leadCreated: created,
      daysWaiting: Math.max(
        0,
        Math.floor((today - new Date(created).getTime()) / 86_400_000)
      ),
    };
  });

  return { cases };
}
