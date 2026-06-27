"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { formatCount } from "@/lib/format";
import type { ComplianceDashboardData } from "@/lib/platform/identity/types";

interface ComplianceDashboardPanelProps {
  stats: ComplianceDashboardData;
  recentSecurityEvents: Array<{
    id: string;
    event_type: string;
    summary: string;
    created_at: string;
  }>;
  pendingApprovals: Array<{
    id: string;
    title: string;
    module: string;
    status: string;
    created_at: string;
  }>;
}

export function ComplianceDashboardPanel({
  stats,
  recentSecurityEvents,
  pendingApprovals,
}: ComplianceDashboardPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="FERPA access events" value={formatCount(stats.ferpaAccessCount)} description="Last 30 days" accent="indigo" icon={<span>F</span>} />
        <StatCard title="Funding alerts" value={formatCount(stats.fundingAlerts)} description="Open items" accent="amber" icon={<span>$</span>} />
        <StatCard title="Pending approvals" value={formatCount(stats.pendingApprovals)} description="Executive matrix" accent="rose" icon={<span>✓</span>} />
        <StatCard title="Expiring certifications" value={formatCount(stats.expiringCertifications)} description="Next 90 days" accent="sky" icon={<span>⏱</span>} />
        <StatCard title="Security events" value={formatCount(stats.securityEvents)} description="Last 30 days" accent="rose" icon={<span>!</span>} />
        <StatCard title="Permission changes" value={formatCount(stats.permissionChanges)} description="Audit trail" accent="violet" icon={<span>◎</span>} />
        <StatCard title="Scholarship pending" value={formatCount(stats.scholarshipPending)} description="Awaiting review" accent="emerald" icon={<span>S</span>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Recent security & audit events</h3>
          <div className="mt-4 space-y-3">
            {recentSecurityEvents.length === 0 && (
              <p className="text-sm text-slate-500">No recent events.</p>
            )}
            {recentSecurityEvents.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-900">{e.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {e.event_type.replace(/_/g, " ")} · {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Outstanding approvals</h3>
          <div className="mt-4 space-y-3">
            {pendingApprovals.length === 0 && (
              <p className="text-sm text-slate-500">No pending approval requests.</p>
            )}
            {pendingApprovals.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-900">{a.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {a.module} · {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
