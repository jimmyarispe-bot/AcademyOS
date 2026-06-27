import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function recordInterventionEffectiveness(
  supabase: AuthClient,
  input: {
    interventionId: string;
    studentId: string;
    minutesDelivered: number;
    sessionsDelivered?: number;
    progressScore?: number;
    progressTrend?: string;
    effectivenessRating?: string;
    outcomeNotes?: string;
    recordedBy?: string | null;
    periodStart?: string;
    periodEnd?: string;
  }
) {
  await supabase.from("intervention_effectiveness_records").insert({
    intervention_id: input.interventionId,
    student_id: input.studentId,
    minutes_delivered: input.minutesDelivered,
    sessions_delivered: input.sessionsDelivered ?? 0,
    progress_score: input.progressScore ?? null,
    progress_trend: input.progressTrend ?? null,
    effectiveness_rating: input.effectivenessRating ?? "pending",
    outcome_notes: input.outcomeNotes ?? null,
    recorded_by: input.recordedBy ?? null,
    period_start: input.periodStart ?? null,
    period_end: input.periodEnd ?? null,
  });
}

export async function getInterventionEffectivenessReport(supabase: AuthClient, studentId: string) {
  const { data: interventions } = await supabase
    .from("student_academic_interventions")
    .select("*")
    .eq("student_id", studentId)
    .order("start_date", { ascending: false });

  const report = [];
  for (const iv of interventions ?? []) {
    const { data: records } = await supabase
      .from("intervention_effectiveness_records")
      .select("*")
      .eq("intervention_id", iv.id)
      .order("recorded_at", { ascending: true });

    const totalMinutes = (records ?? []).reduce((s, r) => s + (r.minutes_delivered ?? 0), 0);
    const latest = records?.[records.length - 1];

    report.push({
      intervention: iv,
      records: records ?? [],
      totalMinutes,
      latestRating: latest?.effectiveness_rating ?? "pending",
      latestTrend: latest?.progress_trend ?? "insufficient_data",
    });
  }

  return report;
}

export async function getOrganizationInterventionEffectiveness(
  supabase: AuthClient,
  schoolId?: string
) {
  let q = supabase
    .from("intervention_effectiveness_records")
    .select("effectiveness_rating, progress_trend, minutes_delivered, students(school_id)")
    .order("recorded_at", { ascending: false })
    .limit(200);

  const { data } = await q;
  const filtered = (data ?? []).filter((r) => {
    if (!schoolId) return true;
    const st = Array.isArray(r.students) ? r.students[0] : r.students;
    return (st as { school_id?: string })?.school_id === schoolId;
  });

  const strong = filtered.filter((r) => r.effectiveness_rating === "strong").length;
  const weak = filtered.filter((r) => r.effectiveness_rating === "weak").length;
  const totalMinutes = filtered.reduce((s, r) => s + (r.minutes_delivered ?? 0), 0);

  return { strong, weak, moderate: filtered.length - strong - weak, totalMinutes, sampleSize: filtered.length };
}
