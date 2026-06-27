import { leadStageLabel } from "@/lib/constants/admissions";
import type { StageHistoryEntry } from "@/lib/admissions/queries";

interface StageTimelineProps {
  history: StageHistoryEntry[];
}

export function StageTimeline({ history }: StageTimelineProps) {
  if (history.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">No stage changes recorded yet.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">User</th>
            <th className="pb-2 pr-4">Old Stage</th>
            <th className="pb-2">New Stage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {history.map((entry) => (
            <tr key={entry.id}>
              <td className="py-2 pr-4 text-slate-600">
                {new Date(entry.changed_at).toLocaleString()}
              </td>
              <td className="py-2 pr-4 text-slate-600">
                {entry.users?.full_name ?? "System"}
              </td>
              <td className="py-2 pr-4 text-slate-600">
                {entry.previous_stage ? leadStageLabel(entry.previous_stage) : "—"}
              </td>
              <td className="py-2 font-medium text-slate-900">
                {leadStageLabel(entry.new_stage)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
