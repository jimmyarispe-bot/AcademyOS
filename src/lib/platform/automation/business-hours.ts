import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface BusinessHoursCheckInput {
  schoolId: string;
  campusId?: string | null;
  scheduleType?: "business" | "school" | "support";
  timezone?: string;
  at?: Date;
}

export async function isWithinBusinessHours(
  supabase: AuthClient,
  input: BusinessHoursCheckInput
): Promise<boolean> {
  const at = input.at ?? new Date();
  const dateStr = at.toISOString().split("T")[0];

  const { data: holidays } = await supabase
    .from("platform_holidays")
    .select("id")
    .eq("holiday_date", dateStr)
    .or(`school_id.is.null,school_id.eq.${input.schoolId}`)
    .limit(1);

  if (holidays?.length) return false;

  let query = supabase
    .from("platform_business_hours")
    .select("*")
    .eq("school_id", input.schoolId)
    .eq("is_active", true);

  if (input.scheduleType) query = query.eq("schedule_type", input.scheduleType);
  if (input.campusId) query = query.or(`campus_id.is.null,campus_id.eq.${input.campusId}`);

  const { data: hours } = await query;
  if (!hours?.length) return true;

  const dayOfWeek = at.getDay();
  const dayHours = hours.filter((h) => h.day_of_week === dayOfWeek);
  if (!dayHours.length) return false;

  const timeStr = at.toTimeString().slice(0, 8);
  return dayHours.some((h) => timeStr >= h.open_time && timeStr <= h.close_time);
}

export async function nextBusinessHoursWindow(
  supabase: AuthClient,
  input: BusinessHoursCheckInput
): Promise<Date> {
  const at = input.at ?? new Date();
  if (await isWithinBusinessHours(supabase, { ...input, at })) return at;

  for (let i = 0; i < 14; i++) {
    const candidate = new Date(at.getTime() + (i + 1) * 86400000);
    candidate.setHours(9, 0, 0, 0);
    if (await isWithinBusinessHours(supabase, { ...input, at: candidate })) {
      return candidate;
    }
  }
  return new Date(at.getTime() + 86400000);
}

export async function adjustScheduledForBusinessHours(
  supabase: AuthClient,
  schoolId: string,
  scheduledFor: Date,
  campusId?: string | null
): Promise<Date> {
  const within = await isWithinBusinessHours(supabase, {
    schoolId,
    campusId,
    at: scheduledFor,
  });
  if (within) return scheduledFor;
  return nextBusinessHoursWindow(supabase, { schoolId, campusId, at: scheduledFor });
}
