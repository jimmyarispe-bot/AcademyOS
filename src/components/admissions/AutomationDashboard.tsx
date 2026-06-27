"use client";

import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCount } from "@/lib/format";
import type { AutomationDashboardMetrics } from "@/lib/admissions/automation/types";

interface AutomationDashboardProps {
  metrics: AutomationDashboardMetrics;
  recentExecutions: Array<{
    id: string;
    trigger_event: string;
    status: string;
    started_at: string;
    error_message: string | null;
    admissions_workflows?: { name: string } | null;
    admissions_leads?: { first_name: string; last_name: string } | null;
  }>;
  pendingQueue: Array<{
    id: string;
    trigger_event: string;
    scheduled_for: string;
    status: string;
    retry_count: number;
    last_error: string | null;
  }>;
}

export function AutomationDashboard({
  metrics,
  recentExecutions,
  pendingQueue,
}: AutomationDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending Automations"
          value={formatCount(metrics.pendingAutomations)}
          description="Queued workflow steps"
          accent="amber"
          icon={<span className="text-sm font-bold">⏳</span>}
        />
        <StatCard
          title="Failed Automations"
          value={formatCount(metrics.failedAutomations)}
          description="Requires attention"
          accent="rose"
          icon={<span className="text-sm font-bold">!</span>}
        />
        <StatCard
          title="Upcoming Reminders"
          value={formatCount(metrics.upcomingReminders)}
          description="Scheduled sends"
          accent="sky"
          icon={<span className="text-sm font-bold">🔔</span>}
        />
        <StatCard
          title="Completed Today"
          value={formatCount(metrics.completedToday)}
          description="Successful runs"
          accent="emerald"
          icon={<span className="text-sm font-bold">✓</span>}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Avg Application Age"
          value={metrics.applicationAgingDays != null ? `${metrics.applicationAgingDays}d` : "—"}
          description="Active pipeline leads"
          accent="indigo"
          icon={<span className="text-sm font-bold">📊</span>}
        />
        <StatCard
          title="Comms Logged"
          value={formatCount(metrics.deliveryLogged)}
          description="Awaiting provider delivery"
          accent="violet"
          icon={<span className="text-sm font-bold">✉</span>}
        />
        <StatCard
          title="Comms Delivered"
          value={formatCount(metrics.deliverySent)}
          description="Sent or delivered"
          accent="emerald"
          icon={<span className="text-sm font-bold">→</span>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Executions</h3>
            <Link href="/dashboard/admissions/workflows" className="text-xs font-medium text-brand-600">
              Manage workflows
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentExecutions.length === 0 && (
              <p className="text-sm text-slate-500">No executions yet.</p>
            )}
            {recentExecutions.map((exec) => (
              <div key={exec.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {exec.admissions_workflows?.name ?? exec.trigger_event}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      exec.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : exec.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {exec.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {exec.admissions_leads
                    ? `${exec.admissions_leads.first_name} ${exec.admissions_leads.last_name}`
                    : "—"}{" "}
                  · {new Date(exec.started_at).toLocaleString()}
                </p>
                {exec.error_message && (
                  <p className="mt-1 text-xs text-red-600">{exec.error_message}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Upcoming Queue</h3>
          <div className="mt-4 space-y-3">
            {pendingQueue.length === 0 && (
              <p className="text-sm text-slate-500">No pending items.</p>
            )}
            {pendingQueue.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-900">{item.trigger_event}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Scheduled {new Date(item.scheduled_for).toLocaleString()}
                  {item.retry_count > 0 ? ` · retry ${item.retry_count}` : ""}
                </p>
                {item.last_error && (
                  <p className="mt-1 text-xs text-red-600">{item.last_error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
