import { createAuthClient } from "@/lib/supabase/server-auth";
import { computePipelineVelocity } from "@/lib/admissions/workflow";
import type { StageHistoryEntry } from "@/lib/admissions/queries";

export interface ExecutiveAdmissionsMetrics {
  newInquiries: number;
  activeLeads: number;
  applicationsStarted: number;
  applicationsSubmitted: number;
  awaitingDocuments: number;
  awaitingStateFunding: number;
  awaitingDecision: number;
  accepted: number;
  waitlisted: number;
  declined: number;
  avgDaysInquiryToAcceptance: number | null;
  acceptanceRate: number | null;
  enrollmentConversionRate: number | null;
  forecastedTuition: number;
  forecastedScholarshipObligations: number;
  forecastedStateFundingRevenue: number;
  pipelineByStage: { stage: string; value: string; count: number }[];
  funnel: { label: string; count: number }[];
}

const ACTIVE_STAGES = [
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

export async function getExecutiveAdmissionsMetrics(): Promise<ExecutiveAdmissionsMetrics> {
  const supabase = await createAuthClient();

  const [
    leadsResult,
    applicationsResult,
    checklistResult,
    stateFundingResult,
    scholarshipsResult,
    tuitionResult,
    historyResult,
  ] = await Promise.all([
    supabase.from("admissions_leads").select("id, lead_stage, inquiry_date, created_at"),
    supabase.from("admissions_applications").select(
      "id, lead_id, application_status, submitted_at"
    ),
    supabase
      .from("admissions_application_checklist_items")
      .select("application_id, status, item_key")
      .eq("status", "pending"),
    supabase
      .from("state_funding_verifications")
      .select("id, verification_status, award_amount")
      .not("verification_status", "eq", "verified"),
    supabase
      .from("scholarship_applications")
      .select("requested_amount, approved_amount, scholarship_status")
      .in("scholarship_status", ["submitted", "under_review", "approved"]),
    supabase.from("tuition_plans").select("annual_amount, program, status").eq("status", "active"),
    supabase.from("admissions_lead_stage_history").select("*").order("changed_at", { ascending: true }),
  ]);

  const leads = leadsResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const pendingChecklist = checklistResult.data ?? [];
  const pendingFunding = stateFundingResult.data ?? [];
  const scholarships = scholarshipsResult.data ?? [];
  const tuitionPlans = tuitionResult.data ?? [];
  const history = (historyResult.data ?? []) as StageHistoryEntry[];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newInquiries = leads.filter(
    (l) => new Date(l.created_at) >= thirtyDaysAgo || l.lead_stage === "new_inquiry"
  ).length;

  const activeLeads = leads.filter((l) => ACTIVE_STAGES.includes(l.lead_stage)).length;
  const applicationsStarted = applications.filter((a) =>
    ["in_progress", "draft"].includes(a.application_status)
  ).length;
  const applicationsSubmitted = applications.filter((a) =>
    ["submitted", "under_review"].includes(a.application_status)
  ).length;

  const appsWithPendingDocs = new Set(
    pendingChecklist
      .filter((c) =>
        ["birth_certificate", "immunization", "report_cards", "medical_forms"].includes(c.item_key)
      )
      .map((c) => c.application_id)
  );

  const awaitingDocuments = appsWithPendingDocs.size;

  const awaitingStateFunding = pendingFunding.filter((f) =>
    ["pending", "documents_submitted", "under_review"].includes(f.verification_status)
  ).length;

  const awaitingDecision = leads.filter((l) =>
    ["application_submitted", "records_requested", "admissions_review"].includes(l.lead_stage)
  ).length;

  const accepted = leads.filter((l) => l.lead_stage === "accepted").length;
  const waitlisted = leads.filter((l) => l.lead_stage === "waitlisted").length;
  const declined = leads.filter((l) => l.lead_stage === "declined").length;
  const enrolled = leads.filter((l) => l.lead_stage === "enrolled").length;

  const inquiryDates = Object.fromEntries(
    leads.map((l) => [l.id, l.inquiry_date ?? l.created_at.split("T")[0]])
  );
  const velocity = computePipelineVelocity(history, inquiryDates);

  const decidedCount = accepted + waitlisted + declined;
  const submittedOrBeyond = applications.filter((a) =>
    ["submitted", "under_review", "accepted", "waitlisted", "denied"].includes(a.application_status)
  ).length;

  const acceptanceRate =
    submittedOrBeyond > 0 ? Math.round((accepted / submittedOrBeyond) * 1000) / 10 : null;

  const enrollmentConversionRate =
    leads.length > 0 ? Math.round((enrolled / leads.length) * 1000) / 10 : null;

  const avgTuition =
    tuitionPlans.length > 0
      ? tuitionPlans.reduce((s, t) => s + Number(t.annual_amount ?? 0), 0) / tuitionPlans.length
      : 12000;

  const forecastedTuition = Math.round(
    (accepted + applicationsSubmitted) * avgTuition * 0.85
  );

  const forecastedScholarshipObligations = scholarships.reduce((s, sch) => {
    const amount =
      sch.scholarship_status === "approved"
        ? Number(sch.approved_amount ?? 0)
        : Number(sch.requested_amount ?? 0) * 0.6;
    return s + amount;
  }, 0);

  const forecastedStateFundingRevenue = pendingFunding.reduce(
    (s, f) => s + Number(f.award_amount ?? 0),
    0
  ) + leads.filter((l) => l.lead_stage === "accepted" || l.lead_stage === "enrolled").length * 7500;

  const stageCounts: Record<string, number> = {};
  for (const l of leads) {
    stageCounts[l.lead_stage] = (stageCounts[l.lead_stage] ?? 0) + 1;
  }

  const pipelineByStage = Object.entries(stageCounts)
    .map(([value, count]) => ({ stage: value.replace(/_/g, " "), value, count }))
    .sort((a, b) => b.count - a.count);

  const funnel = [
    { label: "Inquiries", count: leads.length },
    { label: "Tours", count: leads.filter((l) => ["tour_scheduled", "tour_completed"].includes(l.lead_stage) || ["application_started", "application_submitted", "records_requested", "admissions_review", "accepted", "waitlisted", "enrolled"].includes(l.lead_stage)).length },
    { label: "Applications", count: applications.length },
    { label: "Submitted", count: submittedOrBeyond },
    { label: "Accepted", count: accepted },
    { label: "Enrolled", count: enrolled },
  ];

  return {
    newInquiries,
    activeLeads,
    applicationsStarted,
    applicationsSubmitted,
    awaitingDocuments,
    awaitingStateFunding,
    awaitingDecision,
    accepted,
    waitlisted,
    declined,
    avgDaysInquiryToAcceptance: velocity.avgDaysToAcceptance,
    acceptanceRate,
    enrollmentConversionRate,
    forecastedTuition,
    forecastedScholarshipObligations: Math.round(forecastedScholarshipObligations),
    forecastedStateFundingRevenue: Math.round(forecastedStateFundingRevenue),
    pipelineByStage,
    funnel,
  };
}

export interface DrillDownLead {
  id: string;
  first_name: string;
  last_name: string;
  lead_stage: string;
  guardian_email: string | null;
  inquiry_date: string;
}

export async function getLeadsDrillDown(filter: string): Promise<DrillDownLead[]> {
  const supabase = await createAuthClient();
  let query = supabase
    .from("admissions_leads")
    .select("id, first_name, last_name, lead_stage, guardian_email, inquiry_date")
    .order("inquiry_date", { ascending: false });

  switch (filter) {
    case "new_inquiries": {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte("created_at", thirtyDaysAgo.toISOString());
      break;
    }
    case "active":
      query = query.in("lead_stage", ACTIVE_STAGES);
      break;
    case "accepted":
      query = query.eq("lead_stage", "accepted");
      break;
    case "waitlisted":
      query = query.eq("lead_stage", "waitlisted");
      break;
    case "declined":
      query = query.eq("lead_stage", "declined");
      break;
    case "awaiting_decision":
      query = query.in("lead_stage", [
        "application_submitted",
        "records_requested",
        "admissions_review",
      ]);
      break;
    default:
      if (filter.startsWith("stage:")) {
        query = query.eq("lead_stage", filter.replace("stage:", ""));
      }
  }

  const { data } = await query.limit(100);
  return (data ?? []) as DrillDownLead[];
}
