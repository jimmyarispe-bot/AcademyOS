import Link from "next/link";
import { leadStageColor, leadStageLabel } from "@/lib/constants/admissions";
import { programLabel } from "@/lib/constants/programs";
import { daysInCurrentStage, pipelineAgingClasses } from "@/lib/admissions/workflow";
import { FundingSourceBadges } from "@/components/ui/FundingSourceBadges";
import type { AdmissionLead } from "@/lib/admissions/queries";

interface LeadListProps {
  leads: AdmissionLead[];
}

export function LeadList({ leads }: LeadListProps) {
  if (leads.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No leads yet. Add your first lead to get started.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Stage
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Aging
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Program
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Funding
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Inquiry
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => {
            const days = daysInCurrentStage(lead.stage_entered_at);
            return (
              <tr key={lead.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/admissions/leads/${lead.id}`}
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    {lead.first_name} {lead.last_name}
                  </Link>
                  {lead.guardian_email && (
                    <p className="text-xs text-slate-500">{lead.guardian_email}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${leadStageColor(lead.lead_stage)}`}
                  >
                    {leadStageLabel(lead.lead_stage)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${pipelineAgingClasses(days)}`}
                  >
                    {days}d in stage
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{programLabel(lead.program)}</td>
                <td className="px-4 py-3">
                  <FundingSourceBadges codes={lead.funding_sources} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{lead.inquiry_date}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
