import Link from "next/link";
import type { StudentReadinessSnapshot } from "@/lib/instruction/readiness";

export function SessionReadinessCompact({
  studentId,
  studentName,
  snapshot,
}: {
  studentId: string;
  studentName: string;
  snapshot: StudentReadinessSnapshot;
}) {
  const alertCount =
    snapshot.medicalAlerts.length +
    snapshot.iepAccommodations.length +
    snapshot.activeInterventions.length +
    snapshot.outstandingTasks.length;

  return (
    <details className="mt-3 rounded-lg border border-amber-100 bg-amber-50/40 text-sm">
      <summary className="cursor-pointer px-3 py-2 font-medium text-amber-900">
        Readiness — {studentName}
        {alertCount > 0 && (
          <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs">{alertCount} items</span>
        )}
      </summary>
      <div className="border-t border-amber-100 px-3 py-2 text-xs text-slate-700 space-y-1">
        {snapshot.medicalAlerts.length > 0 && (
          <p><span className="font-medium text-rose-700">Medical:</span> {snapshot.medicalAlerts.join("; ")}</p>
        )}
        {snapshot.iepAccommodations.length > 0 && (
          <p><span className="font-medium text-violet-700">Accommodations:</span> {snapshot.iepAccommodations.slice(0, 3).join("; ")}</p>
        )}
        {snapshot.activeInterventions.length > 0 && (
          <p><span className="font-medium">Interventions:</span> {snapshot.activeInterventions.map((i) => i.type).join(", ")}</p>
        )}
        {snapshot.recentAttendance[0] && (
          <p><span className="font-medium">Last attendance:</span> {snapshot.recentAttendance[0].date} — {snapshot.recentAttendance[0].status.replace(/_/g, " ")}</p>
        )}
        <Link href={`/dashboard/teacher/students/${studentId}?view=overview`} className="inline-block pt-1 text-brand-600 hover:underline">
          Full snapshot →
        </Link>
      </div>
    </details>
  );
}
