import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { CapacitySnapshot } from "@/lib/edi/types";
import { computeBreakEvenAnalysis } from "@/lib/financial-intelligence/break-even";
import { getStaffWorkload } from "@/lib/scheduling/queries";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function computeCapacitySnapshot(
  supabase: AuthClient,
  schoolId: string
): Promise<CapacitySnapshot> {
  const breakEven = await computeBreakEvenAnalysis(supabase, schoolId);
  const workload = await getStaffWorkload(schoolId);

  const totalCapacity = breakEven.totalCapacity;
  const usedSeats = breakEven.usedSeats;
  const availableSeats = breakEven.unusedScheduleCapacity;

  const overloaded = workload.filter((w) => w.overloaded).length;
  const totalStaff = workload.length || 1;
  const teacherUtilizationPct = Math.min(100, Math.round((overloaded / totalStaff) * 100 + (usedSeats / Math.max(totalCapacity, 1)) * 50));

  const { data: rooms } = await supabase
    .from("schedule_rooms")
    .select("id, capacity")
    .eq("school_id", schoolId);

  const roomCount = rooms?.length ?? 1;
  const roomUtilizationPct = Math.min(100, Math.round((usedSeats / Math.max((rooms ?? []).reduce((s, r) => s + (r.capacity ?? 0), 0), 1)) * 100));

  const scheduleUtilizationPct = totalCapacity ? Math.round((usedSeats / totalCapacity) * 100) : 0;
  const campusUtilizationPct = scheduleUtilizationPct;
  const programUtilizationPct = scheduleUtilizationPct;

  const snapshot: CapacitySnapshot = {
    availableSeats,
    usedSeats,
    teacherUtilizationPct,
    roomUtilizationPct,
    scheduleUtilizationPct,
    campusUtilizationPct,
    programUtilizationPct,
    virtualCapacityHours: availableSeats * 2,
    futureCapacitySeats: Math.max(0, totalCapacity - usedSeats),
    projectedShortages: {
      teacher_shortage: overloaded,
      seat_shortage: availableSeats < 10 && scheduleUtilizationPct > 85 ? "high_demand" : null,
      room_gaps: roomCount - Math.ceil(usedSeats / 25),
    },
  };

  const today = new Date().toISOString().split("T")[0];
  await supabase.from("edi_capacity_snapshots").upsert(
    {
      school_id: schoolId,
      snapshot_date: today,
      available_seats: availableSeats,
      used_seats: usedSeats,
      teacher_utilization_pct: teacherUtilizationPct,
      room_utilization_pct: roomUtilizationPct,
      schedule_utilization_pct: scheduleUtilizationPct,
      campus_utilization_pct: campusUtilizationPct,
      program_utilization_pct: programUtilizationPct,
      virtual_capacity_hours: snapshot.virtualCapacityHours,
      future_capacity_seats: snapshot.futureCapacitySeats,
      projected_shortages: snapshot.projectedShortages,
      metrics: { total_capacity: totalCapacity, overloaded_teachers: overloaded },
    },
    { onConflict: "school_id,snapshot_date" }
  );

  return snapshot;
}

export async function getLatestCapacitySnapshot(supabase: AuthClient, schoolId: string) {
  const { data } = await supabase
    .from("edi_capacity_snapshots")
    .select("*")
    .eq("school_id", schoolId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return computeCapacitySnapshot(supabase, schoolId);

  return {
    availableSeats: data.available_seats,
    usedSeats: data.used_seats,
    teacherUtilizationPct: Number(data.teacher_utilization_pct),
    roomUtilizationPct: Number(data.room_utilization_pct),
    scheduleUtilizationPct: Number(data.schedule_utilization_pct),
    campusUtilizationPct: Number(data.campus_utilization_pct),
    programUtilizationPct: Number(data.program_utilization_pct),
    virtualCapacityHours: Number(data.virtual_capacity_hours),
    futureCapacitySeats: data.future_capacity_seats ?? undefined,
    projectedShortages: (data.projected_shortages as Record<string, unknown>) ?? {},
  } satisfies CapacitySnapshot;
}
