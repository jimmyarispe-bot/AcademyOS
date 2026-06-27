"use client";

import { useTransition } from "react";
import { updateScholarshipStatus } from "@/lib/scholarships/actions";
import { SCHOLARSHIP_APPROVER } from "@/lib/constants/admissions";
import { programLabel } from "@/lib/constants/programs";
import { FundingSourceBadges } from "@/components/ui/FundingSourceBadges";
import { formatCurrency } from "@/lib/format";
import type { ScholarshipApplicationRow } from "@/lib/scholarships/queries";

interface ScholarshipReviewListProps {
  applications: ScholarshipApplicationRow[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  denied: "bg-red-100 text-red-700",
};

export function ScholarshipReviewList({ applications }: ScholarshipReviewListProps) {
  const [isPending, startTransition] = useTransition();

  function handleReview(id: string, status: string, amount?: number) {
    startTransition(async () => {
      await updateScholarshipStatus(id, status, amount);
    });
  }

  if (applications.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No scholarship applications yet.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Approver: <span className="font-medium text-slate-900">{SCHOLARSHIP_APPROVER}</span>
      </p>
      {applications.map((app) => {
        const lead = app.admissions_applications?.admissions_leads;
        return (
          <article key={app.id} className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {lead ? `${lead.first_name} ${lead.last_name}` : "Unknown Applicant"}
                </h3>
                {lead?.program && (
                  <p className="text-sm text-slate-500">{programLabel(lead.program)}</p>
                )}
                {lead?.funding_sources && lead.funding_sources.length > 0 && (
                  <div className="mt-2">
                    <FundingSourceBadges codes={lead.funding_sources} />
                  </div>
                )}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[app.scholarship_status] ?? "bg-slate-100"}`}>
                {app.scholarship_status.replace("_", " ")}
              </span>
            </div>

            <dl className="mt-4 grid gap-2 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Requested</dt>
                <dd>{app.requested_amount != null ? formatCurrency(app.requested_amount) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Household Income</dt>
                <dd>{app.household_income != null ? formatCurrency(app.household_income) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Approved</dt>
                <dd>{app.approved_amount != null ? formatCurrency(app.approved_amount) : "—"}</dd>
              </div>
            </dl>

            {["submitted", "under_review"].includes(app.scholarship_status) && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleReview(app.id, "under_review")}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Mark Under Review
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleReview(app.id, "approved", app.requested_amount ?? 0)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleReview(app.id, "denied")}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Deny
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
