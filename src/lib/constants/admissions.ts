export const LEAD_STAGES = [
  { value: "new_inquiry", label: "New Inquiry", color: "bg-slate-100 text-slate-700" },
  { value: "information_sent", label: "Information Sent", color: "bg-blue-100 text-blue-700" },
  { value: "tour_scheduled", label: "Tour Scheduled", color: "bg-sky-100 text-sky-700" },
  { value: "tour_completed", label: "Tour Completed", color: "bg-cyan-100 text-cyan-700" },
  { value: "application_started", label: "Application Started", color: "bg-indigo-100 text-indigo-700" },
  { value: "application_submitted", label: "Application Submitted", color: "bg-violet-100 text-violet-700" },
  { value: "records_requested", label: "Records Requested", color: "bg-purple-100 text-purple-700" },
  { value: "admissions_review", label: "Admissions Review", color: "bg-amber-100 text-amber-700" },
  { value: "accepted", label: "Accepted", color: "bg-emerald-100 text-emerald-700" },
  { value: "waitlisted", label: "Waitlisted", color: "bg-orange-100 text-orange-700" },
  { value: "declined", label: "Declined", color: "bg-red-100 text-red-700" },
  { value: "enrolled", label: "Enrolled", color: "bg-green-100 text-green-800" },
] as const;

export type LeadStageValue = (typeof LEAD_STAGES)[number]["value"];

export const PIPELINE_STAGES: LeadStageValue[] = [
  "new_inquiry",
  "information_sent",
  "tour_scheduled",
  "tour_completed",
  "application_started",
  "application_submitted",
  "records_requested",
  "admissions_review",
  "waitlisted",
];

export function leadStageLabel(value: string | null | undefined): string {
  return LEAD_STAGES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export function leadStageColor(value: string | null | undefined): string {
  return LEAD_STAGES.find((s) => s.value === value)?.color ?? "bg-slate-100 text-slate-700";
}

export const SCHOLARSHIP_APPROVER = "Jimmy Arispe";
