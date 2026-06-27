"use client";

import Link from "next/link";
import { useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCount, formatCurrency } from "@/lib/format";
import type { ExecutiveAdmissionsMetrics, DrillDownLead } from "@/lib/admissions/executive-metrics";

interface ExecutiveAdmissionsDashboardProps {
  metrics: ExecutiveAdmissionsMetrics;
  drillDown: DrillDownLead[];
  drillFilter: string;
}

export function ExecutiveAdmissionsDashboard({
  metrics,
  drillDown,
  drillFilter,
}: ExecutiveAdmissionsDashboardProps) {
  const [activeFilter, setActiveFilter] = useState(drillFilter);

  const kpiCards = [
    { title: "New Inquiries", value: formatCount(metrics.newInquiries), filter: "new_inquiries", accent: "indigo" as const },
    { title: "Active Leads", value: formatCount(metrics.activeLeads), filter: "active", accent: "sky" as const },
    { title: "Apps Started", value: formatCount(metrics.applicationsStarted), filter: "stage:application_started", accent: "violet" as const },
    { title: "Apps Submitted", value: formatCount(metrics.applicationsSubmitted), filter: "awaiting_decision", accent: "amber" as const },
    { title: "Awaiting Documents", value: formatCount(metrics.awaitingDocuments), filter: "active", accent: "rose" as const },
    { title: "Awaiting State Funding", value: formatCount(metrics.awaitingStateFunding), filter: "active", accent: "emerald" as const },
    { title: "Awaiting Decision", value: formatCount(metrics.awaitingDecision), filter: "awaiting_decision", accent: "indigo" as const },
    { title: "Accepted", value: formatCount(metrics.accepted), filter: "accepted", accent: "emerald" as const },
    { title: "Waitlisted", value: formatCount(metrics.waitlisted), filter: "waitlisted", accent: "amber" as const },
    { title: "Declined", value: formatCount(metrics.declined), filter: "declined", accent: "rose" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <Link
            key={card.title}
            href={`/dashboard/admissions?view=executive&drill=${card.filter}`}
            onClick={() => setActiveFilter(card.filter)}
          >
            <StatCard
              title={card.title}
              value={card.value}
              description="Click to drill down"
              accent={card.accent}
              icon={<span className="text-sm font-bold">↗</span>}
            />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Avg Days to Acceptance"
          value={metrics.avgDaysInquiryToAcceptance != null ? `${metrics.avgDaysInquiryToAcceptance}d` : "—"}
          description="Inquiry → acceptance"
          accent="emerald"
          icon={<span>→</span>}
        />
        <StatCard
          title="Acceptance Rate"
          value={metrics.acceptanceRate != null ? `${metrics.acceptanceRate}%` : "—"}
          description="Of submitted applications"
          accent="sky"
          icon={<span>%</span>}
        />
        <StatCard
          title="Enrollment Conversion"
          value={metrics.enrollmentConversionRate != null ? `${metrics.enrollmentConversionRate}%` : "—"}
          description="Inquiry → enrolled"
          accent="violet"
          icon={<span>%</span>}
        />
        <StatCard
          title="Forecasted Tuition"
          value={formatCurrency(metrics.forecastedTuition)}
          description="Projected annual tuition"
          accent="indigo"
          icon={<span>$</span>}
        />
        <StatCard
          title="Forecast Scholarships"
          value={formatCurrency(metrics.forecastedScholarshipObligations)}
          description="Projected aid obligations"
          accent="amber"
          icon={<span>$</span>}
        />
        <StatCard
          title="Forecast State Funding"
          value={formatCurrency(metrics.forecastedStateFundingRevenue)}
          description="Projected ESA/voucher revenue"
          accent="emerald"
          icon={<span>$</span>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Conversion Funnel</h3>
          <ul className="mt-4 space-y-3">
            {metrics.funnel.map((step, i) => {
              const max = metrics.funnel[0]?.count || 1;
              return (
                <li key={step.label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{step.label}</span>
                    <span className="font-medium text-slate-900">{step.count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.round((step.count / max) * 100)}%` }}
                    />
                  </div>
                  {i < metrics.funnel.length - 1 && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {step.count > 0
                        ? `${Math.round(((metrics.funnel[i + 1]?.count ?? 0) / step.count) * 100)}% → next`
                        : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Pipeline by Stage</h3>
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {metrics.pipelineByStage.map((item) => (
              <li key={item.value}>
                <Link
                  href={`/dashboard/admissions?view=executive&drill=stage:${item.value}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="capitalize text-slate-600">{item.stage}</span>
                  <span className="font-medium text-slate-900">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {activeFilter && drillDown.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Drill-down Results</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                  <th className="pb-2 pr-4">Student</th>
                  <th className="pb-2 pr-4">Stage</th>
                  <th className="pb-2 pr-4">Guardian Email</th>
                  <th className="pb-2">Inquiry</th>
                </tr>
              </thead>
              <tbody>
                {drillDown.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/dashboard/admissions/leads/${lead.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {lead.first_name} {lead.last_name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 capitalize text-slate-600">
                      {lead.lead_stage.replace(/_/g, " ")}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{lead.guardian_email ?? "—"}</td>
                    <td className="py-2 text-slate-600">{lead.inquiry_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
