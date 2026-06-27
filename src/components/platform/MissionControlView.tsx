"use client";

import Link from "next/link";
import { useTransition } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCount } from "@/lib/format";
import { resolveMissionControlItemAction } from "@/lib/platform/automation/server-actions";

interface MissionControlViewProps {
  feed: Array<{
    id: string;
    module: string;
    item_type: string;
    severity: string;
    title: string;
    body: string;
    href: string | null;
    created_at: string;
  }>;
  queueMetrics: Record<string, number>;
  summary: {
    pendingTasks: number;
    overdueTasks: number;
    failedAutomations: number;
    openItems: number;
  };
  userRole: string | null;
  accessDenied?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  normal: "bg-slate-100 text-slate-700 border-slate-200",
  low: "bg-blue-50 text-blue-700 border-blue-100",
};

export function MissionControlView({ feed, queueMetrics, summary, userRole, accessDenied }: MissionControlViewProps) {
  const [isPending, startTransition] = useTransition();

  if (accessDenied) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Mission Control access required</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your role does not include the Mission Control permission. Contact an administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-200/80 bg-gradient-to-br from-brand-50 to-indigo-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Mission Control</h2>
        <p className="mt-1 text-sm text-slate-600">
          Role-specific operations center for {userRole?.replace(/_/g, " ") ?? "your organization"}.
          Pending tasks, failed automations, funding alerts, and executive flags in one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Open Items"
          value={formatCount(summary.openItems)}
          description="Requires attention"
          accent="indigo"
          icon={<span className="text-sm font-bold">◎</span>}
        />
        <StatCard
          title="Failed Automations"
          value={formatCount(summary.failedAutomations)}
          description="Workflow errors"
          accent="rose"
          icon={<span className="text-sm font-bold">!</span>}
        />
        <StatCard
          title="Queue Pending"
          value={formatCount(queueMetrics.pending ?? 0)}
          description="Platform jobs"
          accent="amber"
          icon={<span className="text-sm font-bold">⏳</span>}
        />
        <StatCard
          title="Queue Failed"
          value={formatCount(queueMetrics.failed ?? 0)}
          description="Retry or investigate"
          accent="rose"
          icon={<span className="text-sm font-bold">✕</span>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Active Alerts</h3>
          <div className="mt-4 space-y-3">
            {feed.length === 0 && (
              <p className="text-sm text-slate-500">No open mission control items.</p>
            )}
            {feed.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-4 ${SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.normal}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-xs opacity-80">
                      {item.module} · {item.item_type.replace(/_/g, " ")} ·{" "}
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                    {item.body && <p className="mt-2 text-sm opacity-90">{item.body}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {item.href && (
                      <Link href={item.href} className="text-xs font-medium underline">
                        Open
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await resolveMissionControlItemAction(item.id);
                        })
                      }
                      className="text-xs opacity-70 hover:opacity-100"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
            <h3 className="text-sm font-semibold text-slate-900">Quick Links</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/dashboard/admissions/automation" className="text-brand-600 hover:underline">
                  Automation Dashboard
                </Link>
              </li>
              <li>
                <Link href="/dashboard/admissions/workflows" className="text-brand-600 hover:underline">
                  Workflow Builder
                </Link>
              </li>
              <li>
                <Link href="/dashboard/admissions/communications" className="text-brand-600 hover:underline">
                  Template Library
                </Link>
              </li>
              <li>
                <Link href="/dashboard/automation/marketplace" className="text-brand-600 hover:underline">
                  Workflow Marketplace
                </Link>
              </li>
              <li>
                <Link href="/dashboard/ceo" className="text-brand-600 hover:underline">
                  CEO Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
            <h3 className="text-sm font-semibold text-slate-900">Queue Status</h3>
            <dl className="mt-3 space-y-2 text-sm">
              {Object.entries(queueMetrics).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <dt className="capitalize text-slate-500">{status}</dt>
                  <dd className="font-medium text-slate-900">{count}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
