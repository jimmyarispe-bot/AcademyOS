import Link from "next/link";
import { ActivityTimelineFeed } from "@/components/platform/profile-sections/ActivityTimelineFeed";
import { ProfileTagsList } from "@/components/platform/profile-sections/ProfileTagsList";
import { ProfileSectionPlaceholder } from "@/components/platform/profile-workspace/ProfileSectionPlaceholder";
import {
  ProfileCard,
  ProfileEmpty,
  ProfileItem,
} from "@/components/platform/profile-workspace/ProfilePrimitives";
import { buildFamilyProfileSectionHref } from "@/lib/families/profile/href";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";
import type { PlatformActivityEvent } from "@/lib/platform/activity/types";
import type { PlatformEntityTag } from "@/lib/platform/tags/types";
import type { PlatformRelationship } from "@/lib/platform/relationships/types";
import { isFamilyProfileEnvelope } from "@/lib/families/profile/types";
import { EmailLink } from "@/components/platform/contact/ContactLink";

interface OverviewMetrics {
  studentCount: number;
  guardianCount: number;
  tuitionBalance: number;
  scholarshipCount: number;
  openAdmissions: number;
  missingDocuments: number;
  upcomingMeetings: number;
  transportationRoutes: number;
  alertCount: number;
  criticalAlerts: number;
}

type FamilyOverviewData = {
  family: Record<string, unknown> | null;
  students: Record<string, unknown>[];
  guardians: Record<string, unknown>[];
  studentRelationships: PlatformRelationship[];
  guardianRelationships: PlatformRelationship[];
  tags: PlatformEntityTag[];
  metrics: OverviewMetrics;
  upcomingMeetingsList: Record<string, unknown>[];
  recentActivity: PlatformActivityEvent[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function schoolName(family: Record<string, unknown> | null): string {
  if (!family) return "—";
  const school = family.schools as { name?: string } | { name?: string }[] | null;
  return Array.isArray(school) ? (school[0]?.name ?? "—") : (school?.name ?? "—");
}

function DashboardStatCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  href: string;
  tone?: "default" | "alert";
}) {
  const toneClass =
    tone === "alert"
      ? "border-amber-200 bg-amber-50/60 hover:border-amber-300"
      : "border-slate-200 bg-white hover:border-brand-200";

  return (
    <Link
      href={href}
      className={`rounded-xl border p-4 transition-colors ${toneClass}`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </Link>
  );
}

export function FamilyOverviewSection(props: ProfileSectionViewProps) {
  const envelope = isFamilyProfileEnvelope(props.envelope) ? props.envelope : null;
  const data = props.data as FamilyOverviewData | null;

  if (!envelope || !data?.family || !data.metrics) {
    return <ProfileSectionPlaceholder title="Overview" status="live" />;
  }

  const familyId = envelope.familyId;
  const { metrics } = data;

  return (
    <div className="space-y-6">
      <ProfileCard title="Household Dashboard">
        <p className="mb-4 text-sm text-slate-600">
          Operational snapshot for {envelope.displayName} at {schoolName(data.family)}.
        </p>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardStatCard
            label="Students"
            value={String(metrics.studentCount)}
            href={buildFamilyProfileSectionHref(familyId, "students")}
          />
          <DashboardStatCard
            label="Guardians"
            value={String(metrics.guardianCount)}
            href={buildFamilyProfileSectionHref(familyId, "parents-guardians")}
          />
          <DashboardStatCard
            label="Tuition Balance"
            value={formatCurrency(metrics.tuitionBalance)}
            href={buildFamilyProfileSectionHref(familyId, "tuition")}
          />
          <DashboardStatCard
            label="Scholarships"
            value={String(metrics.scholarshipCount)}
            href={buildFamilyProfileSectionHref(familyId, "scholarships")}
          />
          <DashboardStatCard
            label="Open Admissions"
            value={String(metrics.openAdmissions)}
            href={buildFamilyProfileSectionHref(familyId, "overview")}
          />
          <DashboardStatCard
            label="Missing Documents"
            value={String(metrics.missingDocuments)}
            href={buildFamilyProfileSectionHref(familyId, "documents")}
            tone={metrics.missingDocuments > 0 ? "alert" : "default"}
          />
          <DashboardStatCard
            label="Upcoming Meetings"
            value={String(metrics.upcomingMeetings)}
            href={buildFamilyProfileSectionHref(familyId, "calendar")}
          />
          <DashboardStatCard
            label="Transportation"
            value={String(metrics.transportationRoutes)}
            href={buildFamilyProfileSectionHref(familyId, "transportation")}
          />
          <DashboardStatCard
            label="Alerts"
            value={
              metrics.criticalAlerts > 0
                ? `${metrics.alertCount} (${metrics.criticalAlerts} critical)`
                : String(metrics.alertCount)
            }
            href={buildFamilyProfileSectionHref(familyId, "activity")}
            tone={metrics.alertCount > 0 ? "alert" : "default"}
          />
          <DashboardStatCard
            label="Recent Activity"
            value={String(data.recentActivity.length)}
            href={buildFamilyProfileSectionHref(familyId, "activity")}
          />
        </section>
      </ProfileCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard title="Household Members">
          {data.students.length === 0 ? (
            <ProfileEmpty>No students linked to this household</ProfileEmpty>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.students.map((student) => (
                <li
                  key={String(student.id)}
                  className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span>
                    {String(student.first_name)} {String(student.last_name)}
                  </span>
                  <span className="text-slate-500">
                    {[student.grade_level, student.program].filter(Boolean).join(" · ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">
            {data.studentRelationships.length} platform relationship
            {data.studentRelationships.length === 1 ? "" : "s"} (student.family)
          </p>
        </ProfileCard>

        <ProfileCard title="Upcoming Meetings">
          {data.upcomingMeetingsList.length === 0 ? (
            <ProfileEmpty>No upcoming meetings scheduled</ProfileEmpty>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.upcomingMeetingsList.map((meeting) => {
                const students = meeting.students as
                  | { first_name?: string; last_name?: string }
                  | { first_name?: string; last_name?: string }[]
                  | null;
                const student = Array.isArray(students) ? students[0] : students;
                const studentLabel = student
                  ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim()
                  : "Student";
                return (
                  <li key={String(meeting.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="font-medium">{String(meeting.title ?? "Meeting")}</p>
                    <p className="text-slate-500">
                      {studentLabel}
                      {meeting.scheduled_at
                        ? ` · ${new Date(String(meeting.scheduled_at)).toLocaleString()}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </ProfileCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard title="Household Details">
          <dl className="grid gap-3 sm:grid-cols-2">
            <ProfileItem label="Status" value={String(data.family.status ?? "—")} />
            <ProfileItem label="School" value={schoolName(data.family)} />
            <ProfileItem
              label="Billing email"
              value={<EmailLink email={data.family.billing_email as string | null} />}
            />
            <ProfileItem
              label="Address"
              value={String(data.family.primary_address ?? "—")}
            />
          </dl>
        </ProfileCard>

        {data.tags.length > 0 && (
          <div>
            <ProfileTagsList tags={data.tags} />
          </div>
        )}
      </div>

      <ActivityTimelineFeed
        events={data.recentActivity}
        title="Recent Activity"
        emptyMessage="No recent household activity"
        limit={10}
      />
    </div>
  );
}
