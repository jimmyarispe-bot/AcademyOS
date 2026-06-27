"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { formatCount } from "@/lib/format";
import type { SecurityEventSummary } from "@/lib/platform/identity/types";

interface SecurityDashboardPanelProps {
  stats: SecurityEventSummary;
  events: Array<{
    id: string;
    event_type: string;
    summary: string;
    ip_address: string | null;
    created_at: string;
  }>;
  impersonationHistory: Array<{
    id: string;
    actor_user_id: string;
    target_user_id: string;
    reason: string;
    started_at: string;
    ended_at: string | null;
    is_active: boolean;
  }>;
}

export function SecurityDashboardPanel({
  stats,
  events,
  impersonationHistory,
}: SecurityDashboardPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Failed logins" value={formatCount(stats.failedLogins)} description="Last 30 days" accent="rose" icon={<span>!</span>} />
        <StatCard title="Permission changes" value={formatCount(stats.permissionChanges)} description="Last 30 days" accent="amber" icon={<span>◎</span>} />
        <StatCard title="Role assignments" value={formatCount(stats.roleAssignments)} description="Last 30 days" accent="indigo" icon={<span>+</span>} />
        <StatCard title="Impersonations" value={formatCount(stats.impersonations)} description="Last 30 days" accent="amber" icon={<span>↔</span>} />
        <StatCard title="Exports" value={formatCount(stats.exports)} description="Last 30 days" accent="sky" icon={<span>↓</span>} />
        <StatCard title="Sensitive access" value={formatCount(stats.sensitiveAccess)} description="Last 30 days" accent="rose" icon={<span>🔒</span>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Recent security events</h3>
          <div className="mt-4 space-y-3">
            {events.length === 0 && <p className="text-sm text-slate-500">No events in the last 30 days.</p>}
            {events.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-900">{e.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {e.event_type.replace(/_/g, " ")} · {new Date(e.created_at).toLocaleString()}
                  {e.ip_address ? ` · ${e.ip_address}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Impersonation history</h3>
          <div className="mt-4 space-y-3">
            {impersonationHistory.length === 0 && (
              <p className="text-sm text-slate-500">No impersonation sessions recorded.</p>
            )}
            {impersonationHistory.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-900">
                  {s.is_active ? "Active session" : "Session ended"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {s.reason || "No reason provided"} · {new Date(s.started_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
