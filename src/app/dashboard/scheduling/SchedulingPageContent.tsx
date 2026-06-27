import { StatCard } from "@/components/dashboard/StatCard";
import { SchedulingTabs } from "@/components/scheduling/SchedulingTabs";
import { RunIntelligenceButton } from "@/components/scheduling/SchedulingActions";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCount } from "@/lib/format";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { generateSchedulingRecommendations } from "@/lib/scheduling/intelligence";
import {
  getAcademicCalendarEvents,
  getCourseSections,
  getScheduleConflicts,
  getScheduleRooms,
  getSchedulingExecutiveStats,
  getStaffWorkload,
  getUpcomingSessions,
} from "@/lib/scheduling/queries";
import { createAuthClient } from "@/lib/supabase/server-auth";

export const SCHEDULING_TABS = [
  { href: "/dashboard/scheduling?view=executive", label: "Executive", value: "executive" },
  { href: "/dashboard/scheduling?view=calendar", label: "Calendar", value: "calendar" },
  { href: "/dashboard/scheduling?view=sections", label: "Sections", value: "sections" },
  { href: "/dashboard/scheduling?view=sessions", label: "Sessions", value: "sessions" },
  { href: "/dashboard/scheduling?view=rooms", label: "Rooms", value: "rooms" },
  { href: "/dashboard/scheduling?view=workload", label: "Workload", value: "workload" },
  { href: "/dashboard/scheduling?view=intelligence", label: "Intelligence", value: "intelligence" },
] as const;

interface SchedulingPageContentProps {
  searchParams: Promise<{ view?: string }>;
}

export async function SchedulingPageContent({ searchParams }: SchedulingPageContentProps) {
  const { view: rawView } = await searchParams;
  const validViews = new Set(SCHEDULING_TABS.map((tab) => tab.value));
  const view =
    rawView && validViews.has(rawView as (typeof SCHEDULING_TABS)[number]["value"])
      ? rawView
      : "executive";

  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0] ||
    ctx?.orgAssignments[0]?.school_id;

  const from = new Date().toISOString().split("T")[0];
  const toDate = new Date(Date.now() + 90 * 86400000);
  const to = toDate.toISOString().split("T")[0];

  const [stats, sections, sessions, rooms, conflicts, calendarEvents, workload] = await Promise.all([
    getSchedulingExecutiveStats(schoolId),
    getCourseSections(schoolId),
    getUpcomingSessions(schoolId),
    getScheduleRooms(schoolId),
    getScheduleConflicts(schoolId),
    schoolId ? getAcademicCalendarEvents(schoolId, from, to) : Promise.resolve([]),
    schoolId ? getStaffWorkload(schoolId) : Promise.resolve([]),
  ]);

  const supabase = await createAuthClient();
  const recommendations = schoolId
    ? await generateSchedulingRecommendations(supabase, schoolId)
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Academic Operations & Scheduling"
          subtitle="Enterprise scheduling engine — calendars, sessions, therapy, rooms, and Academy Way rules"
        />
        <RunIntelligenceButton schoolId={schoolId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Sessions this week"
          value={formatCount(stats.sessionsThisWeek)}
          description="Scheduled instructional events"
          accent="indigo"
          icon={<span className="text-lg font-bold">S</span>}
        />
        <StatCard
          title="Open conflicts"
          value={formatCount(stats.openConflicts)}
          description="Requires attention"
          accent="rose"
          icon={<span className="text-lg font-bold">!</span>}
        />
        <StatCard
          title="Open sections"
          value={formatCount(stats.openSections)}
          description={`${stats.openSeats} total seats`}
          accent="emerald"
          icon={<span className="text-lg font-bold">§</span>}
        />
        <StatCard
          title="Utilization"
          value={`${stats.teacherUtilization}%`}
          description="Completed vs scheduled (7d)"
          accent="sky"
          icon={<span className="text-lg font-bold">U</span>}
        />
      </div>

      <ViewTabs tabs={[...SCHEDULING_TABS]} activeView={view} />

      <SchedulingTabs
        view={view}
        sections={sections}
        sessions={sessions}
        rooms={rooms}
        conflicts={conflicts}
        calendarEvents={calendarEvents}
        workload={workload}
        recommendations={recommendations}
      />
    </div>
  );
}

export function SchedulingPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-11 rounded-xl bg-slate-100" />
      <div className="h-64 rounded-2xl bg-slate-100" />
    </div>
  );
}
