"use client";

import type { AutomationAuditEntry } from "@/lib/admissions/automation/types";

interface StaffTimelinePanelProps {
  entries: AutomationAuditEntry[];
}

export function StaffTimelinePanel({ entries }: StaffTimelinePanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900">Staff Activity & Audit Trail</h3>
      <p className="mt-1 text-xs text-slate-500">
        Who verified funding, accepted students, edited records, and ran automations
      </p>
      <div className="mt-4 space-y-3">
        {entries.length === 0 && (
          <p className="text-sm text-slate-500">No audit entries yet.</p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="border-l-2 border-brand-200 pl-4">
            <p className="text-sm font-medium text-slate-900">{entry.summary}</p>
            <p className="mt-1 text-xs text-slate-500">
              {entry.event_type} · {new Date(entry.created_at).toLocaleString()}
              {entry.users?.full_name ? ` · ${entry.users.full_name}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
