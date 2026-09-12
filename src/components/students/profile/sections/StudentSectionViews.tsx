import Link from "next/link";
import { ActivityTimelineFeed } from "@/components/platform/profile-sections/ActivityTimelineFeed";
import { CommunicationTimeline } from "@/components/communications/CommunicationTimeline";
import { ProfileRelationshipsList } from "@/components/platform/profile-sections/ProfileRelationshipsList";
import { ProfileTagsList } from "@/components/platform/profile-sections/ProfileTagsList";
import { ProfileSectionPlaceholder } from "@/components/platform/profile-workspace/ProfileSectionPlaceholder";
import {
  AcademicPanel,
  AttendancePanel,
  BehaviorPanel,
  BillingPanel,
  DocumentsPanel,
  EngagementPanel,
  FundingPanel,
  GraduationReadinessPanel,
  GradeHistoryPanel,
  LearningJourneyPanel,
  MedicalPanel,
  OverviewPanel,
  PlaceholderMessagePanel,
  ProfilePanel,
  SchedulingPanel,
  ServicesPanel,
  SpedPanel,
  TeachersPanel,
} from "@/components/students/profile/panels/StudentProfilePanels";
import { ProfileCard, ProfileEmpty, ProfileItem } from "@/components/students/profile/shared/ProfilePrimitives";
import { FamilyLinkActions } from "@/components/students/FamilyLinkActions";
import { StudentFamilyRelationshipActions } from "@/components/students/StudentFamilyRelationshipActions";
import { buildFamilyProfileSectionHref } from "@/lib/families/profile/href";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";
import type { PlatformActivityEvent } from "@/lib/platform/activity/types";
import type { StudentConversionLink } from "@/lib/sis/queries";
import type { ExecutiveSummary } from "@/lib/ssis/queries";
import type { Family, GuardianRecord, SisEnrollment, StudentRecord } from "@/lib/students/queries";
import { isStudentProfileEnvelope } from "@/lib/students/profile/types";
import type { PlatformEntityTag } from "@/lib/platform/tags/types";
import type { PlatformRelationship } from "@/lib/platform/relationships/types";
import { EmailLink, PhoneLink } from "@/components/platform/contact/ContactLink";

function displayName(student: StudentRecord): string {
  return student.preferred_name
    ? `${student.preferred_name} (${student.first_name} ${student.last_name})`
    : `${student.first_name} ${student.last_name}`;
}

export function OverviewSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    student: StudentRecord;
    summary: ExecutiveSummary;
    enrollments?: SisEnrollment[];
    conversion?: StudentConversionLink | null;
  } | null;
  if (!data?.student || !data.summary) {
    return <ProfileSectionPlaceholder title="Overview" status="live" />;
  }
  return (
    <OverviewPanel
      student={data.student}
      summary={data.summary}
      conversion={data.conversion ?? null}
      enrollments={data.enrollments ?? []}
      displayName={displayName(data.student)}
    />
  );
}

export function IdentitySection(props: ProfileSectionViewProps) {
  const data = props.data as { student: StudentRecord; tags: PlatformEntityTag[] } | null;
  if (!data?.student) {
    return <ProfileSectionPlaceholder title="Identity" status="live" />;
  }
  return (
    <div className="space-y-6">
      <ProfileTagsList tags={data.tags ?? []} />
      <ProfilePanel
        student={data.student}
        enrollments={[]}
        conversion={null}
        lifecycleHistory={[]}
      />
    </div>
  );
}

export function AdmissionsSection(props: ProfileSectionViewProps) {
  const conversion = props.data as StudentConversionLink | null;
  if (!conversion) {
    return (
      <ProfileCard title="Admissions">
        <ProfileEmpty>No admissions conversion record linked to this student.</ProfileEmpty>
      </ProfileCard>
    );
  }
  return (
    <ProfileCard title="Admissions Conversion">
      <dl className="grid gap-3 sm:grid-cols-2">
        <ProfileItem label="Lead ID" value={conversion.lead_id} />
        <ProfileItem label="Source" value={conversion.conversion_source} />
        <ProfileItem label="Converted" value={new Date(conversion.converted_at).toLocaleDateString()} />
      </dl>
      <Link
        href={`/dashboard/admissions/leads/${conversion.lead_id}`}
        className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        View admissions lead →
      </Link>
    </ProfileCard>
  );
}

export function EnrollmentSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    student: StudentRecord;
    enrollments: SisEnrollment[];
    conversion: StudentConversionLink | null;
    lifecycleHistory: Record<string, unknown>[];
    gradeHistory?: {
      lifecycle: Record<string, unknown>[];
      enrollments: Record<string, unknown>[];
      courseEnrollments: Record<string, unknown>[];
    };
  } | null;
  if (!data?.student) {
    return <ProfileSectionPlaceholder title="Enrollment" status="live" />;
  }
  return (
    <div className="space-y-6">
      <ProfilePanel
        student={data.student}
        enrollments={data.enrollments}
        conversion={data.conversion}
        lifecycleHistory={data.lifecycleHistory}
      />
      {data.gradeHistory && (
        <GradeHistoryPanel
          lifecycle={data.gradeHistory.lifecycle}
          enrollments={data.gradeHistory.enrollments}
          courseEnrollments={data.gradeHistory.courseEnrollments}
        />
      )}
    </div>
  );
}

export function LearningJourneySection(props: ProfileSectionViewProps) {
  const data = props.data as {
    journey: Record<string, unknown> | null;
    domains: Record<string, unknown>[];
    competencies: Record<string, unknown>[];
    evidence: Record<string, unknown>[];
  } | null;
  if (!data) return <ProfileSectionPlaceholder title="Learning Journey" status="live" />;
  return (
    <LearningJourneyPanel
      journey={data.journey}
      domains={data.domains}
      competencies={data.competencies}
      evidence={data.evidence}
    />
  );
}

export function GraduationReadinessSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    graduationScore: number;
    ruleOutcome?: string;
    explanation?: string;
    successScore: Record<string, unknown> | null;
    proficientCount: number;
    evidenceCount: number;
  } | null;
  if (!data) return <ProfileSectionPlaceholder title="Graduation Readiness" status="live" />;
  return <GraduationReadinessPanel {...data} />;
}

export function TeachersSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    team: Record<string, unknown> | null;
    members: Record<string, unknown>[];
  } | null;
  if (!data) return <ProfileSectionPlaceholder title="Teachers & Team" status="live" />;
  return <TeachersPanel team={data.team} members={data.members} />;
}

export function AcademicsSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    academic: {
      profile: Record<string, unknown> | null;
      assessments: Record<string, unknown>[];
      goals: Record<string, unknown>[];
      interventions: Record<string, unknown>[];
    };
    spedPlans: Record<string, unknown>[];
  } | null;
  if (!data) return <ProfileSectionPlaceholder title="Academics" status="live" />;
  return (
    <div className="space-y-6">
      <AcademicPanel data={data.academic} />
      {data.spedPlans.length > 0 && <SpedPanel plans={data.spedPlans} reviewDue={false} />}
    </div>
  );
}

export function ProgressSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    goals: Record<string, unknown>[];
    interventions: Record<string, unknown>[];
    profile: Record<string, unknown> | null;
  } | null;
  if (!data) return <ProfileSectionPlaceholder title="Progress Monitoring" status="partial" />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ProfileCard title="Goals">
        {data.goals.length === 0 ? (
          <ProfileEmpty>No progress goals on file</ProfileEmpty>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.goals.map((g) => (
              <li key={String(g.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                {String(g.goal_description ?? g.title ?? "Goal")}
              </li>
            ))}
          </ul>
        )}
      </ProfileCard>
      <ProfileCard title="Interventions">
        {data.interventions.length === 0 ? (
          <ProfileEmpty>No active interventions</ProfileEmpty>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.interventions.map((i) => (
              <li key={String(i.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                {String(i.intervention_type)}
              </li>
            ))}
          </ul>
        )}
      </ProfileCard>
    </div>
  );
}

export function MapNweaSection(props: ProfileSectionViewProps) {
  const data = props.data as { connectorKey: string; results: unknown[]; message?: string } | null;
  return (
    <PlaceholderMessagePanel
      title="MAP / NWEA"
      message={
        data?.message ??
        "NWEA MAP connector results will appear here when the assessment integration is enabled."
      }
    />
  );
}

export function AttendanceSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    records: Record<string, unknown>[];
    summary: ExecutiveSummary | null;
  } | null;
  if (!data) return <ProfileSectionPlaceholder title="Attendance" status="live" />;
  return <AttendancePanel records={data.records} summary={data.summary} />;
}

export function BehaviorSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    events: Record<string, unknown>[];
    summary: ExecutiveSummary | null;
  } | null;
  if (!data) return <ProfileSectionPlaceholder title="Behavior" status="live" />;
  return <BehaviorPanel events={data.events} summary={data.summary} />;
}

export function SchedulingSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    sessions: Record<string, unknown>[];
    services: Record<string, unknown>[];
    courseEnrollments?: Record<string, unknown>[];
    platformOccurrences?: Array<{
      id: string;
      title: string;
      eventType: string;
      startsAt: string;
      endsAt: string;
    }>;
    studentId?: string;
  } | null;

  if (!data) {
    return <ProfileSectionPlaceholder title="Scheduling" status="partial" />;
  }

  return (
    <div className="space-y-6">
      {data.studentId ? (
        <p className="text-sm">
          <Link
            href={`/dashboard/calendar?view=agenda&studentId=${data.studentId}`}
            className="font-medium text-brand-700 underline"
          >
            Open student calendar
          </Link>
        </p>
      ) : null}
      {(data.platformOccurrences?.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Upcoming platform events (30 days)
          </h3>
          <ul className="space-y-2 text-sm">
            {data.platformOccurrences!.slice(0, 12).map((event) => (
              <li key={event.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{event.title}</span>
                  <span className="text-xs capitalize text-slate-500">
                    {event.eventType.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-slate-500">
                  {new Date(event.startsAt).toLocaleString()} –{" "}
                  {new Date(event.endsAt).toLocaleTimeString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <SchedulingPanel
        sessions={data.sessions}
        services={data.services}
        courseEnrollments={data.courseEnrollments ?? []}
      />
    </div>
  );
}

export function SpecialEdSection(props: ProfileSectionViewProps) {
  const data = props.data as { plans: Record<string, unknown>[]; reviewDue: boolean } | null;
  return <SpedPanel plans={data?.plans ?? []} reviewDue={data?.reviewDue ?? false} />;
}

export function TherapySection(props: ProfileSectionViewProps) {
  const sessions = (props.data as Record<string, unknown>[] | null) ?? [];
  return <ServicesPanel sessions={sessions} count={sessions.length} />;
}

export function MedicalSection(props: ProfileSectionViewProps) {
  const data = props.data as { medical: Record<string, unknown> | null; alertCount: number } | null;
  return <MedicalPanel medical={data?.medical ?? null} alertCount={data?.alertCount ?? 0} />;
}

export function FamilySection(props: ProfileSectionViewProps) {
  const data = props.data as {
    student: StudentRecord;
    guardians: GuardianRecord[];
    authorizedContacts: Record<string, unknown>[];
    siblings: Record<string, unknown>[];
    households: Record<string, unknown>[];
    relationships: PlatformRelationship[];
    families?: Family[];
    canManageFamily?: boolean;
  } | null;
  const env = isStudentProfileEnvelope(props.envelope) ? props.envelope : null;
  if (!data) return <ProfileSectionPlaceholder title="Family & Guardians" status="live" />;

  const familyId = env?.familyId ?? data.student?.family_id ?? null;
  const familyName = data.student?.families?.family_name;
  const canManageFamily =
    data.canManageFamily ??
    Boolean(
      env?.permissions.includes("families.manage") || env?.permissions.includes("students.edit")
    );

  return (
    <div className="space-y-6">
      <ProfileCard title={familyName ? `Family: ${familyName}` : "Family & Guardians"}>
        {!familyId ? (
          data.student?.school_id ? (
            <FamilyLinkActions
              studentId={data.student.id}
              studentLastName={data.student.last_name}
              schoolId={data.student.school_id}
              families={(data.families ?? []).map((f) => ({
                id: f.id,
                family_name: f.family_name,
                billing_email: f.billing_email,
              }))}
              canManage={Boolean(canManageFamily)}
            />
          ) : (
            <ProfileEmpty>No family has been linked yet.</ProfileEmpty>
          )
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <ProfileItem label="Guardians" value={String(data.guardians.length)} />
              <ProfileItem label="Households" value={String(data.households.length)} />
              <ProfileItem label="Siblings" value={String(data.siblings.length)} />
              <ProfileItem label="Contacts" value={String(data.authorizedContacts.length)} />
            </div>
            {data.guardians.length > 0 && (
              <div>
                <p className="text-xs uppercase text-slate-400">Guardians</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {data.guardians.map((g) => (
                    <li key={g.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      {g.first_name} {g.last_name}
                      {g.is_primary && <span className="ml-2 text-xs text-brand-600">Primary</span>}
                      {g.email && (
                        <span className="ml-2">
                          <EmailLink email={g.email} />
                        </span>
                      )}
                      {g.phone && (
                        <span className="ml-2">
                          <PhoneLink phone={g.phone} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.siblings.length > 0 && (
              <div>
                <p className="text-xs uppercase text-slate-400">Siblings</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {data.siblings.map((sibling) => {
                    const id = String(sibling.id ?? "");
                    const first = String(sibling.first_name ?? "");
                    const last = String(sibling.last_name ?? "");
                    const initial = first[0]?.toUpperCase() ?? "?";
                    const photo = sibling.photo_url ? String(sibling.photo_url) : null;
                    const schoolName =
                      sibling.schools && typeof sibling.schools === "object"
                        ? String((sibling.schools as { name?: string }).name ?? "")
                        : "";
                    return (
                      <Link
                        key={id}
                        href={`/dashboard/students/${id}`}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-brand-200 hover:bg-brand-50/30"
                      >
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo} alt="" className="h-10 w-10 object-cover" />
                          ) : (
                            initial
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {first} {last}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {[sibling.grade_level, sibling.program, schoolName || null]
                              .filter(Boolean)
                              .map(String)
                              .join(" · ") || "Sibling"}
                          </p>
                          <p className="text-[11px] capitalize text-slate-400">
                            {String(sibling.status ?? sibling.enrollment_status ?? "active")}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            {data.authorizedContacts.length > 0 && (
              <div>
                <p className="text-xs uppercase text-slate-400">Emergency & Authorized Contacts</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {data.authorizedContacts.map((c) => (
                    <li key={String(c.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                      <span className="font-medium capitalize">{String(c.contact_type ?? "contact").replace(/_/g, " ")}</span>
                      {" — "}
                      {String(c.first_name)} {String(c.last_name)}
                      {c.phone ? (
                        <span className="ml-2">
                          <PhoneLink phone={String(c.phone)} />
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {canManageFamily && data.student?.school_id ? (
              <StudentFamilyRelationshipActions
                studentId={data.student.id}
                studentLastName={data.student.last_name}
                schoolId={data.student.school_id}
                currentFamilyId={familyId}
                families={(data.families ?? []).map((f) => ({
                  id: f.id,
                  family_name: f.family_name,
                }))}
                canManage={canManageFamily}
              />
            ) : null}
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href={buildFamilyProfileSectionHref(familyId, "overview")}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                View family profile →
              </Link>
              <Link
                href={buildFamilyProfileSectionHref(familyId, "parents-guardians")}
                className="text-slate-600 hover:text-brand-600"
              >
                Guardians
              </Link>
              <Link
                href={buildFamilyProfileSectionHref(familyId, "household")}
                className="text-slate-600 hover:text-brand-600"
              >
                Household
              </Link>
              <Link
                href={buildFamilyProfileSectionHref(familyId, "tuition")}
                className="text-slate-600 hover:text-brand-600"
              >
                Tuition
              </Link>
            </div>
          </div>
        )}
      </ProfileCard>
      <ProfileRelationshipsList relationships={data.relationships ?? []} />
    </div>
  );
}

export function BillingSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    profile: Record<string, unknown> | null;
    studentId?: string;
    message?: string;
  } | null;
  if (data?.message && !data.profile) {
    return <PlaceholderMessagePanel title="Tuition & Billing" message={data.message} />;
  }
  return (
    <BillingPanel
      profile={data?.profile ?? null}
      studentId={data?.studentId ?? ""}
    />
  );
}

export function ScholarshipsSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    funding: Record<string, unknown>[];
    scholarships: Record<string, unknown>[];
  } | null;
  const env = isStudentProfileEnvelope(props.envelope) ? props.envelope : null;
  if (!data || !env) return <ProfileSectionPlaceholder title="Scholarships" status="live" />;
  return (
    <FundingPanel records={data.scholarships.length ? data.scholarships : data.funding} summary={null} schoolId={env.schoolId ?? ""} />
  );
}

export function TransportationSection(props: ProfileSectionViewProps) {
  const data = props.data as { routes: PlatformRelationship[] } | null;
  if (!data?.routes?.length) {
    return (
      <ProfileCard title="Transportation">
        <ProfileEmpty>No transportation routes assigned</ProfileEmpty>
      </ProfileCard>
    );
  }
  return (
    <ProfileCard title="Transportation Routes">
      <ProfileRelationshipsList relationships={data.routes} />
    </ProfileCard>
  );
}

export function DocumentsSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    documents: Record<string, unknown>[];
    conversion: StudentConversionLink | null;
  } | null;
  if (!data) return <ProfileSectionPlaceholder title="Documents" status="live" />;
  return <DocumentsPanel documents={data.documents} conversion={data.conversion} />;
}

export function ComplianceSection(props: ProfileSectionViewProps) {
  const data = props.data as { obligations: unknown[]; message?: string } | null;
  return (
    <PlaceholderMessagePanel
      title="Compliance"
      message={data?.message ?? "Student-scoped compliance obligations will appear here."}
    />
  );
}

export function CommunicationsSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    activity?: PlatformActivityEvent[];
    platformCommunications?: Array<{
      id: string;
      auditId: string;
      type: string;
      direction: string;
      status: string;
      subject: string | null;
      bodyPreview: string | null;
      senderDisplayName: string | null;
      createdAt: string;
      sentAt: string | null;
      studentId: string | null;
      familyId: string | null;
      source: "platform_communications";
    }>;
    studentId?: string;
    familyId?: string | null;
  } | null;

  // Backward compatible: older loaders returned a bare activity array
  if (Array.isArray(props.data)) {
    return (
      <ActivityTimelineFeed
        events={props.data as PlatformActivityEvent[]}
        title="Communications"
        emptyMessage="No communication events recorded"
      />
    );
  }

  const events = data?.activity ?? [];
  const platform = (data?.platformCommunications ?? []) as Parameters<
    typeof CommunicationTimeline
  >[0]["items"];
  const composeQs = new URLSearchParams();
  if (data?.studentId) composeQs.set("studentId", data.studentId);
  if (data?.familyId) composeQs.set("familyId", data.familyId);

  return (
    <div className="space-y-6">
      <CommunicationTimeline
        items={platform}
        title="Student communication timeline"
        emptyMessage="No platform communications for this student yet"
        composeHref={`/dashboard/communications/compose?${composeQs.toString()}`}
      />
      <ActivityTimelineFeed
        events={events}
        title="Communication activity"
        emptyMessage="No communication events recorded"
      />
    </div>
  );
}

export function ParentEngagementSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    events: Record<string, unknown>[];
    engagementScore: number;
    portalLogins: number;
    messages: number;
    documentUploads: number;
    disengaged: boolean;
  } | null;
  if (!data) return <ProfileSectionPlaceholder title="Parent Engagement" status="live" />;
  return <EngagementPanel data={data} />;
}

export function AiInsightsSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    graduationScore: number;
    ruleOutcome?: string;
    explanation?: string;
    successScore: Record<string, unknown> | null;
    proficientCount: number;
    evidenceCount: number;
  } | null;
  if (!data) {
    return <ProfileSectionPlaceholder title="AI Insights" status="partial" />;
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Intelligence derived from Rules Engine™, PAJ competency progress, and SSIS success scoring.
      </p>
      <GraduationReadinessPanel {...data} />
    </div>
  );
}

export function TimelineSection(props: ProfileSectionViewProps) {
  const events = (props.data as PlatformActivityEvent[] | null) ?? [];
  return <ActivityTimelineFeed events={events} title="Activity Timeline" />;
}

export function AuditSection(props: ProfileSectionViewProps) {
  const events = (props.data as PlatformActivityEvent[] | null) ?? [];
  return (
    <ActivityTimelineFeed
      events={events}
      title="Audit History"
      emptyMessage="No audit events recorded"
    />
  );
}
