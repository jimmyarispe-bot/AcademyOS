import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { FundingSourceBadges } from "@/components/ui/FundingSourceBadges";
import { gradeLabel } from "@/lib/constants/grades";
import { programLabel } from "@/lib/constants/programs";
import type { GuardianRecord, SisEnrollment, StudentRecord } from "@/lib/students/queries";
import type { StudentConversionLink } from "@/lib/sis/queries";
import type { ExecutiveSummary } from "@/lib/ssis/queries";
import { SuccessScoreBadge, SuccessScoreBreakdown } from "@/components/students/SuccessScoreBadge";
import { StudentSuccessQuickActions } from "@/components/students/StudentSuccessQuickActions";

export const STUDENT_DETAIL_TABS = [
  { href: "?tab=overview", label: "Success Dashboard", value: "overview" },
  { href: "?tab=profile", label: "Profile", value: "profile" },
  { href: "?tab=family", label: "Family", value: "family" },
  { href: "?tab=medical", label: "Medical", value: "medical" },
  { href: "?tab=special-ed", label: "Special Ed", value: "special-ed" },
  { href: "?tab=academic", label: "Academic Growth", value: "academic" },
  { href: "?tab=attendance", label: "Attendance", value: "attendance" },
  { href: "?tab=behavior", label: "Behavior", value: "behavior" },
  { href: "?tab=services", label: "Services", value: "services" },
  { href: "?tab=funding", label: "Funding", value: "funding" },
  { href: "?tab=documents", label: "Documents", value: "documents" },
  { href: "?tab=communication", label: "Timeline", value: "communication" },
  { href: "?tab=engagement", label: "Parent Engagement", value: "engagement" },
] as const;

interface StudentDetailContentProps {
  student: StudentRecord;
  tab: string;
  summary: ExecutiveSummary;
  conversion: StudentConversionLink | null;
  enrollments: SisEnrollment[];
  guardians: GuardianRecord[];
  authorizedContacts: Record<string, unknown>[];
  medical: Record<string, unknown> | null;
  spedPlans: Record<string, unknown>[];
  academic: {
    profile: Record<string, unknown> | null;
    assessments: Record<string, unknown>[];
    goals: Record<string, unknown>[];
    interventions: Record<string, unknown>[];
  };
  attendance: Record<string, unknown>[];
  behavior: Record<string, unknown>[];
  services: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  funding: Record<string, unknown>[];
  timeline: {
    communications: Record<string, unknown>[];
    platformEvents: Record<string, unknown>[];
    missionControlAlerts: Record<string, unknown>[];
    admissionsCommunications: Record<string, unknown>[];
  };
  engagement: {
    events: Record<string, unknown>[];
    engagementScore: number;
    portalLogins: number;
    messages: number;
    documentUploads: number;
    disengaged: boolean;
  };
  siblings: Record<string, unknown>[];
  households: Record<string, unknown>[];
  lifecycleHistory: Record<string, unknown>[];
}

export function StudentDetailContent({
  student,
  tab,
  summary,
  conversion,
  enrollments,
  guardians,
  authorizedContacts,
  medical,
  spedPlans,
  academic,
  attendance,
  behavior,
  services,
  documents,
  funding,
  timeline,
  engagement,
  siblings,
  households,
  lifecycleHistory,
}: StudentDetailContentProps) {
  const activeTab = STUDENT_DETAIL_TABS.some((t) => t.value === tab) ? tab : "overview";
  const displayName = student.preferred_name
    ? `${student.preferred_name} (${student.first_name} ${student.last_name})`
    : `${student.first_name} ${student.last_name}`;

  return (
    <div className="space-y-6">
      <ViewTabs
        tabs={STUDENT_DETAIL_TABS.map((t) => ({
          ...t,
          href: `/dashboard/students/${student.id}${t.href}`,
        }))}
        activeView={activeTab}
      />

      {activeTab === "overview" && (
        <>
          <OverviewPanel
            student={student}
            summary={summary}
            conversion={conversion}
            enrollments={enrollments}
            displayName={displayName}
          />
          <StudentSuccessQuickActions
            studentId={student.id}
            lifecycleStage={summary.lifecycleStage}
          />
        </>
      )}
      {activeTab === "profile" && (
        <ProfilePanel
          student={student}
          enrollments={enrollments}
          conversion={conversion}
          lifecycleHistory={lifecycleHistory}
        />
      )}
      {activeTab === "family" && (
        <FamilyPanel
          guardians={guardians}
          authorizedContacts={authorizedContacts}
          familyName={student.families?.family_name}
          siblings={siblings}
          households={households}
        />
      )}
      {activeTab === "medical" && <MedicalPanel medical={medical} alertCount={summary.medicalAlertCount} />}
      {activeTab === "special-ed" && <SpedPanel plans={spedPlans} reviewDue={summary.spedReviewDue} />}
      {activeTab === "academic" && <AcademicPanel data={academic} />}
      {activeTab === "attendance" && <AttendancePanel records={attendance} summary={summary} />}
      {activeTab === "behavior" && <BehaviorPanel events={behavior} summary={summary} />}
      {activeTab === "services" && <ServicesPanel sessions={services} count={summary.activeServicesCount} />}
      {activeTab === "documents" && <DocumentsPanel documents={documents} conversion={conversion} />}
      {activeTab === "funding" && <FundingPanel records={funding} summary={summary} schoolId={student.school_id} />}
      {activeTab === "communication" && <CommunicationPanel timeline={timeline} />}
      {activeTab === "engagement" && <EngagementPanel data={engagement} />}
    </div>
  );
}

function OverviewPanel({
  student,
  summary,
  conversion,
  enrollments,
  displayName,
}: {
  student: StudentRecord;
  summary: ExecutiveSummary;
  conversion: StudentConversionLink | null;
  enrollments: SisEnrollment[];
  displayName: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-xl font-bold text-brand-700">
          {student.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.photo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            student.first_name[0]?.toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">{displayName}</h2>
          <p className="text-sm text-slate-500">
            ID {student.student_number ?? "—"} · {gradeLabel(student.grade_level)} · {programLabel(student.program)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge label={summary.lifecycleStage} />
            <Badge label={student.enrollment_status} />
            {summary.successScore && (
              <SuccessScoreBadge
                score={summary.successScore.overallScore}
                indicator={summary.successScore.statusIndicator}
              />
            )}
            {summary.medicalAlertCount > 0 && <Badge label={`${summary.medicalAlertCount} medical alerts`} tone="amber" />}
            {summary.spedReviewDue && <Badge label="SPED review due" tone="rose" />}
            {summary.parentDisengaged && <Badge label="Low parent engagement" tone="amber" />}
            {summary.missionControlAlertCount > 0 && (
              <Badge label={`${summary.missionControlAlertCount} MC alerts`} tone="rose" />
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {summary.successScore && (
            <SuccessScoreBadge
              score={summary.successScore.overallScore}
              indicator={summary.successScore.statusIndicator}
              size="lg"
            />
          )}
          {conversion && (
          <Link
            href={`/dashboard/admissions/leads/${conversion.lead_id}`}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View admissions history →
          </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Attendance" value={`${summary.attendanceRate}%`} description="This month" accent="emerald" icon={<span>✓</span>} />
        <StatCard title="Academic Growth" value={String(summary.successScore?.componentScores.academic_growth ?? "—")} description="Success score component" accent="indigo" icon={<span>A</span>} />
        <StatCard title="Scholarships" value={String(summary.scholarshipCount)} description="Funding records" accent="sky" icon={<span>$</span>} />
        <StatCard title="State Funding" value={summary.stateFundingVerified ? "Verified" : "Pending"} description="Verification status" accent="amber" icon={<span>F</span>} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Behavior" value={`${summary.positiveBehaviorCount}+`} description={`${summary.incidentCount} incidents`} accent="indigo" icon={<span>B</span>} />
        <StatCard title="Services" value={String(summary.activeServicesCount)} description="Scheduled sessions" accent="sky" icon={<span>S</span>} />
        <StatCard title="Parent Engagement" value={String(summary.parentEngagementScore)} description={summary.parentDisengaged ? "Disengaged" : "Active"} accent="emerald" icon={<span>P</span>} />
        <StatCard title="Tasks" value={String(summary.outstandingTasks)} description="Mission Control open items" accent="rose" icon={<span>T</span>} />
      </div>

      {summary.successScore && (
        <Card title="Student Success Score">
          <SuccessScoreBreakdown components={summary.successScore.componentScores} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Funding">
          <FundingSourceBadges codes={student.funding_sources} />
        </Card>
        <Card title="Enrollment">
          {enrollments.length === 0 ? (
            <Empty>No enrollments</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {enrollments.map((e) => (
                <li key={e.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{e.school_years?.name ?? "—"}</span>
                  <span className="capitalize text-slate-500">{e.enrollment_status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
function ProfilePanel({
  student,
  enrollments,
  conversion,
  lifecycleHistory,
}: {
  student: StudentRecord;
  enrollments: SisEnrollment[];
  conversion: StudentConversionLink | null;
  lifecycleHistory: Record<string, unknown>[];
}) {
  const stateIds = Array.isArray(student.state_student_ids) ? student.state_student_ids : [];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Master Record">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item label="Legal Name" value={`${student.first_name} ${student.last_name}`} />
          <Item label="Preferred Name" value={student.preferred_name ?? "—"} />
          <Item label="Student ID" value={student.student_number ?? "—"} />
          <Item label="DOB" value={student.date_of_birth ?? "—"} />
          <Item label="Grade" value={gradeLabel(student.grade_level)} />
          <Item label="Program" value={programLabel(student.program)} />
          <Item label="School" value={student.schools?.name ?? "—"} />
          <Item label="Campus" value={student.campuses?.name ?? "—"} />
          <Item label="Lifecycle" value={student.lifecycle_stage ?? "—"} />
          <Item label="Status" value={student.enrollment_status} />
          <Item label="Start Date" value={student.enrollment_start_date ?? "—"} />
          <Item label="Exit Date" value={student.enrollment_exit_date ?? "—"} />
          <Item label="Graduation Year" value={student.graduation_year ? String(student.graduation_year) : "—"} />
          <Item
            label="State Student IDs"
            value={stateIds.length ? stateIds.map((s: { state: string; id: string }) => `${s.state}: ${s.id}`).join(", ") : "—"}
          />
        </dl>
      </Card>
      <Card title="Enrollments">
        {enrollments.length === 0 ? (
          <Empty>No enrollments recorded</Empty>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="pb-2">Year</th>
                <th className="pb-2">Program</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="py-2">{e.school_years?.name ?? "—"}</td>
                  <td className="py-2">{programLabel(e.program)}</td>
                  <td className="py-2 capitalize">{e.enrollment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {conversion && (
          <p className="mt-4 text-xs text-slate-400">
            Converted from admissions on {new Date(conversion.converted_at).toLocaleDateString()} ({conversion.conversion_source})
          </p>
        )}
      </Card>
      {lifecycleHistory.length > 0 && (
        <Card title="Lifecycle History">
          <ul className="space-y-2 text-sm">
            {lifecycleHistory.map((t) => (
              <li key={String(t.id)} className="rounded-lg bg-slate-50 px-3 py-2 capitalize">
                {String(t.from_stage)} → {String(t.to_stage)}
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(String(t.created_at)).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function FamilyPanel({
  guardians,
  authorizedContacts,
  familyName,
  siblings,
  households,
}: {
  guardians: GuardianRecord[];
  authorizedContacts: Record<string, unknown>[];
  familyName?: string | null;
  siblings: Record<string, unknown>[];
  households: Record<string, unknown>[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title={familyName ? `Family: ${familyName}` : "Guardians"}>
        {guardians.length === 0 ? (
          <Empty>No guardians linked</Empty>
        ) : (
          <ul className="space-y-2">
            {guardians.map((g) => (
              <li key={g.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium">{g.first_name} {g.last_name}</span>
                {g.is_primary && <span className="ml-2 text-xs text-brand-600">Primary</span>}
                {g.email && <p className="text-slate-500">{g.email}</p>}
                {g.phone && <p className="text-slate-500">{g.phone}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Authorized Contacts">
        {authorizedContacts.length === 0 ? (
          <Empty>No additional contacts</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {authorizedContacts.map((c) => (
              <li key={String(c.id)} className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="font-medium">{String(c.first_name)} {String(c.last_name)}</span>
                <span className="ml-2 text-xs capitalize text-slate-400">{String(c.contact_type)}</span>
                {Boolean(c.can_pick_up) && <span className="ml-2 text-xs text-emerald-600">Pickup OK</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {households.length > 0 && (
        <Card title="Households">
          <ul className="space-y-2 text-sm">
            {households.map((h) => (
              <li key={String(h.id)} className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="font-medium">{String(h.label)}</span>
                {Boolean(h.is_primary) && <span className="ml-2 text-xs text-brand-600">Primary</span>}
                {Boolean(h.address) && <p className="text-slate-500">{String(h.address)}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {siblings.length > 0 && (
        <Card title="Siblings">
          <ul className="space-y-2 text-sm">
            {siblings.map((s) => (
              <li key={String(s.id)} className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="font-medium">{String(s.first_name)} {String(s.last_name)}</span>
                <span className="ml-2 text-xs text-slate-400">{String(s.relationship_label)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function MedicalPanel({ medical, alertCount }: { medical: Record<string, unknown> | null; alertCount: number }) {
  if (!medical) return <Card title="Medical"><Empty>No medical profile on file</Empty></Card>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Health Summary">
        {alertCount > 0 && <Badge label={`${alertCount} active alerts`} tone="amber" />}
        <JsonList label="Allergies" items={medical.allergies} />
        <JsonList label="Medications" items={medical.medications} />
        <JsonList label="Diagnoses" items={medical.diagnoses} />
      </Card>
      <Card title="Care Team & Plans">
        <Item label="Physician" value={String(medical.physician_name ?? "—")} />
        <Item label="Insurance" value={String(medical.insurance_carrier ?? "—")} />
        {Boolean(medical.seizure_plan) && <Item label="Seizure Plan" value="On file" />}
        {Boolean(medical.diabetes_plan) && <Item label="Diabetes Plan" value="On file" />}
        {Boolean(medical.emergency_medical_plan) && (
          <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{String(medical.emergency_medical_plan)}</p>
        )}
      </Card>
    </div>
  );
}

function SpedPanel({ plans, reviewDue }: { plans: Record<string, unknown>[]; reviewDue: boolean }) {
  return (
    <div className="space-y-4">
      {reviewDue && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A special education review is due within 30 days.
        </div>
      )}
      {plans.length === 0 ? (
        <Card title="Special Education"><Empty>No IEP or 504 plans on file</Empty></Card>
      ) : (
        plans.map((plan) => (
          <Card key={String(plan.id)} title={`${String(plan.plan_type).toUpperCase()} Plan`}>
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              <Item label="Status" value={String(plan.status)} />
              <Item label="Eligibility" value={String(plan.eligibility_category ?? "—")} />
              <Item label="Annual Review" value={String(plan.annual_review_date ?? "—")} />
              <Item label="Reevaluation" value={String(plan.reevaluation_date ?? "—")} />
            </dl>
          </Card>
        ))
      )}
    </div>
  );
}

function AcademicPanel({ data }: { data: StudentDetailContentProps["academic"] }) {
  const p = data.profile;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Learning Profile">
        {!p ? (
          <Empty>No learning profile</Empty>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <Item label="Reading" value={String(p.reading_level ?? "—")} />
            <Item label="Math" value={String(p.math_level ?? "—")} />
            <Item label="Writing" value={String(p.writing_level ?? "—")} />
            <Item label="Structured Literacy" value={String(p.structured_literacy_level ?? "—")} />
            <Item label="IEP Status" value={String(p.iep_status ?? "none")} />
          </dl>
        )}
      </Card>
      <Card title="Assessments & Interventions">
        <p className="text-xs uppercase text-slate-400">Recent Assessments ({data.assessments.length})</p>
        {data.assessments.slice(0, 5).map((a) => (
          <p key={String(a.id)} className="mt-1 text-sm">
            {String(a.assessment_type)} — {String(a.score ?? "—")} ({String(a.assessed_on)})
          </p>
        ))}
        <p className="mt-4 text-xs uppercase text-slate-400">Active Interventions ({data.interventions.length})</p>
        {data.interventions.slice(0, 5).map((i) => (
          <p key={String(i.id)} className="mt-1 text-sm">{String(i.intervention_type)}</p>
        ))}
      </Card>
    </div>
  );
}

function AttendancePanel({ records, summary }: { records: Record<string, unknown>[]; summary: ExecutiveSummary }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Rate" value={`${summary.attendanceRate}%`} description="This month" accent="emerald" icon={<span>A</span>} />
        <StatCard title="Absences" value={String(summary.absencesThisMonth)} description="This month" accent="amber" icon={<span>A</span>} />
        <StatCard title="Tardies" value={String(summary.tardiesThisMonth)} description="This month" accent="rose" icon={<span>T</span>} />
      </div>
      <Card title="Recent Attendance">
        {records.length === 0 ? (
          <Empty>No attendance recorded</Empty>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="pb-2">Date</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={String(r.id)} className="border-t border-slate-100">
                  <td className="py-2">{String(r.attendance_date)}</td>
                  <td className="py-2 capitalize">{String(r.status).replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function BehaviorPanel({ events, summary }: { events: Record<string, unknown>[]; summary: ExecutiveSummary }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Positive" value={String(summary.positiveBehaviorCount)} description="This month" accent="emerald" icon={<span>+</span>} />
        <StatCard title="Incidents" value={String(summary.incidentCount)} description="This month" accent="rose" icon={<span>!</span>} />
      </div>
      <Card title="Recent Events">
        {events.length === 0 ? (
          <Empty>No behavior events</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={String(e.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium capitalize">{String(e.event_type).replace(/_/g, " ")}</span>
                <span className="ml-2 text-slate-500">{String(e.title)}</span>
                <p className="text-xs text-slate-400">{new Date(String(e.occurred_at)).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ServicesPanel({ sessions, count }: { sessions: Record<string, unknown>[]; count: number }) {
  return (
    <Card title={`Student Services (${count} upcoming)`}>
      {sessions.length === 0 ? (
        <Empty>No service sessions recorded</Empty>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="pb-2">Type</th>
              <th className="pb-2">Scheduled</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={String(s.id)} className="border-t border-slate-100">
                <td className="py-2 capitalize">{String(s.service_type).replace(/_/g, " ")}</td>
                <td className="py-2">{s.scheduled_at ? new Date(String(s.scheduled_at)).toLocaleString() : "—"}</td>
                <td className="py-2 capitalize">{String(s.session_status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function DocumentsPanel({
  documents,
  conversion,
}: {
  documents: Record<string, unknown>[];
  conversion: StudentConversionLink | null;
}) {
  return (
    <Card title="Document Vault">
      {conversion && (
        <p className="mb-4 text-sm text-slate-500">
          Documents inherited from admissions are marked with source type &quot;admissions&quot;.
        </p>
      )}
      {documents.length === 0 ? (
        <Empty>No documents on file</Empty>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="pb-2">Type</th>
              <th className="pb-2">File</th>
              <th className="pb-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={String(d.id)} className="border-t border-slate-100">
                <td className="py-2 capitalize">{String(d.document_type).replace(/_/g, " ")}</td>
                <td className="py-2">{String(d.file_name)}</td>
                <td className="py-2 capitalize">{String(d.source_type ?? "upload")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function FundingPanel({
  records,
  summary,
  schoolId,
}: {
  records: Record<string, unknown>[];
  summary: ExecutiveSummary;
  schoolId: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Funding Records" value={String(summary.fundingRecordCount)} description="All sources" accent="indigo" icon={<span>F</span>} />
        <StatCard title="Scholarships" value={String(summary.scholarshipCount)} description="School + outside" accent="sky" icon={<span>S</span>} />
        <StatCard title="State Funding" value={summary.stateFundingVerified ? "Verified" : "Pending"} description="ESA / vouchers" accent="emerald" icon={<span>V</span>} />
      </div>
      <Card title="Funding Center">
        {records.length === 0 ? (
          <Empty>No funding records synced yet</Empty>
        ) : (
          <>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Program</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={String(r.id)} className="border-t border-slate-100">
                    <td className="py-2 capitalize">{String(r.funding_category).replace(/_/g, " ")}</td>
                    <td className="py-2">{String(r.program_name ?? "—")}</td>
                    <td className="py-2">{r.award_amount ? `$${r.award_amount}` : "—"}</td>
                    <td className="py-2 capitalize">{String(r.verification_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <a
              href={`/api/ssis/funding-export?schoolId=${encodeURIComponent(schoolId)}`}
              className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Export funding report (CSV) →
            </a>
          </>
        )}
      </Card>
    </div>
  );
}

function eventTime(e: Record<string, unknown>): number {
  return new Date(String(e.occurred_at ?? e.sent_at ?? e.created_at ?? 0)).getTime();
}

function CommunicationPanel({
  timeline,
}: {
  timeline: StudentDetailContentProps["timeline"];
}) {
  const allEvents: Record<string, unknown>[] = [
    ...timeline.communications.map((e) => ({ ...(e as Record<string, unknown>), source: "ssis" })),
    ...timeline.admissionsCommunications.map((e) => {
      const row = e as Record<string, unknown>;
      return {
        ...row,
        source: "admissions",
        occurred_at: row.sent_at,
        subject: row.subject,
        channel: row.communication_type,
      };
    }),
    ...timeline.platformEvents.map((e) => ({ ...(e as Record<string, unknown>), source: "platform" })),
  ].sort((a, b) => eventTime(b) - eventTime(a));

  return (
    <div className="space-y-4">
      {timeline.missionControlAlerts.length > 0 && (
        <Card title="Mission Control Alerts">
          <ul className="space-y-2 text-sm">
            {timeline.missionControlAlerts.map((a) => (
              <li key={String(a.id)} className="rounded-lg bg-amber-50 px-3 py-2">
                <span className="font-medium">{String(a.title)}</span>
                {!a.is_resolved && <span className="ml-2 text-xs text-amber-700">Open</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Communication Timeline">
        {allEvents.length === 0 ? (
          <Empty>No communication events recorded</Empty>
        ) : (
          <ul className="space-y-3">
            {allEvents.slice(0, 50).map((e, i) => (
              <li key={i} className="border-l-2 border-brand-200 pl-3 text-sm">
                <div className="flex flex-wrap gap-2 text-xs uppercase text-slate-400">
                  <span>{String(e.channel ?? e.event_type ?? "event")}</span>
                  <span>{new Date(String(e.occurred_at ?? e.sent_at ?? e.created_at)).toLocaleString()}</span>
                </div>
                <p className="font-medium text-slate-900">{String(e.subject ?? e.title ?? "Event")}</p>
                {(e.body as string) && <p className="text-slate-500 line-clamp-2">{String(e.body)}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function EngagementPanel({ data }: { data: StudentDetailContentProps["engagement"] }) {
  return (
    <div className="space-y-4">
      {data.disengaged && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This family shows low engagement over the last 30 days. Consider outreach.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Score" value={String(data.engagementScore)} description="30-day engagement" accent="indigo" icon={<span>E</span>} />
        <StatCard title="Portal Logins" value={String(data.portalLogins)} description="Last 30 days" accent="emerald" icon={<span>L</span>} />
        <StatCard title="Messages" value={String(data.messages)} description="Last 30 days" accent="sky" icon={<span>M</span>} />
        <StatCard title="Uploads" value={String(data.documentUploads)} description="Documents" accent="amber" icon={<span>U</span>} />
      </div>
      <Card title="Engagement History">
        {data.events.length === 0 ? (
          <Empty>No engagement events recorded</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.events.map((e) => (
              <li key={String(e.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium capitalize">{String(e.event_type).replace(/_/g, " ")}</span>
                <span className="ml-2 text-slate-500">{String(e.summary)}</span>
                <p className="text-xs text-slate-400">{new Date(String(e.occurred_at)).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 capitalize">{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}

function Badge({ label, tone = "slate" }: { label: string; tone?: "slate" | "amber" | "rose" }) {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[tone]}`}>
      {label}
    </span>
  );
}

function JsonList({ label, items }: { label: string; items: unknown }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
        {list.map((item, i) => (
          <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
        ))}
      </ul>
    </div>
  );
}
