import { gradeLabel } from "@/lib/constants/grades";
import { programLabel } from "@/lib/constants/programs";
import { leadStageColor, leadStageLabel } from "@/lib/constants/admissions";
import {
  daysInCurrentStage,
  pipelineAgingClasses,
  totalDaysInPipeline,
} from "@/lib/admissions/workflow";
import { FundingSourceBadges } from "@/components/ui/FundingSourceBadges";
import { NotesPanel } from "./NotesPanel";
import { TasksPanel } from "./TasksPanel";
import { StageTimeline } from "./StageTimeline";
import type {
  AdmissionLead,
  AdmissionNote,
  AdmissionTask,
  AdmissionTour,
  StageHistoryEntry,
} from "@/lib/admissions/queries";

interface LeadDetailProps {
  lead: AdmissionLead;
  notes: AdmissionNote[];
  tasks: AdmissionTask[];
  tours: AdmissionTour[];
  stageHistory: StageHistoryEntry[];
}

export function LeadDetail({ lead, notes, tasks, tours, stageHistory }: LeadDetailProps) {
  const daysInStage = daysInCurrentStage(lead.stage_entered_at);
  const daysInPipeline = totalDaysInPipeline(lead.inquiry_date);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {lead.first_name} {lead.last_name}
              </h2>
              {lead.preferred_name && (
                <p className="text-sm text-slate-500">Goes by {lead.preferred_name}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${leadStageColor(lead.lead_stage)}`}>
                {leadStageLabel(lead.lead_stage)}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${pipelineAgingClasses(daysInStage)}`}
                title="Days in current stage"
              >
                {daysInStage}d in stage
              </span>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailItem label="School" value={lead.schools?.name ?? "—"} />
            <DetailItem label="Program" value={programLabel(lead.program)} />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Funding Sources</dt>
              <dd className="mt-1">
                <FundingSourceBadges codes={lead.funding_sources} />
              </dd>
            </div>
            <DetailItem label="Inquiry Date" value={lead.inquiry_date} />
            <DetailItem label="Current Grade" value={gradeLabel(lead.current_grade)} />
            <DetailItem label="Applying For" value={gradeLabel(lead.applying_for_grade)} />
            <DetailItem label="Date of Birth" value={lead.date_of_birth ?? "—"} />
            <DetailItem label="Referral" value={lead.referral_source ?? "—"} />
            <DetailItem label="Days in Current Stage" value={`${daysInStage} days`} />
            <DetailItem label="Total Days in Pipeline" value={`${daysInPipeline} days`} />
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Stage Timeline</h3>
          <StageTimeline history={stageHistory} />
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Guardian</h3>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailItem
              label="Name"
              value={
                lead.guardian_first_name || lead.guardian_last_name
                  ? `${lead.guardian_first_name ?? ""} ${lead.guardian_last_name ?? ""}`.trim()
                  : "—"
              }
            />
            <DetailItem label="Email" value={lead.guardian_email ?? "—"} />
            <DetailItem label="Phone" value={lead.guardian_phone ?? "—"} />
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Tours</h3>
          {tours.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No tours scheduled.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tours.map((tour) => (
                <li key={tour.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-900">
                    {new Date(tour.scheduled_at).toLocaleString()}
                  </span>
                  <span className="ml-2 text-slate-500 capitalize">{tour.tour_type}</span>
                  {tour.campuses?.name && (
                    <span className="ml-2 text-slate-500">· {tour.campuses.name}</span>
                  )}
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs capitalize">
                    {tour.tour_status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <NotesPanel leadId={lead.id} notes={notes} />
        <TasksPanel leadId={lead.id} tasks={tasks} />
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  );
}
