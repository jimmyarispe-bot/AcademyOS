import { StatCard } from "@/components/dashboard/StatCard";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { FundingBreakdown } from "@/components/ui/FundingBreakdown";
import { StudentList } from "@/components/students/StudentList";
import { FamilyList } from "@/components/students/FamilyList";
import { StudentForm } from "@/components/students/StudentForm";
import { formatCount } from "@/lib/format";
import {
  getFamilies,
  getSchools,
  getSchoolYears,
  getStudents,
  getStudentStats,
} from "@/lib/students/queries";

export const STUDENT_TABS = [
  { href: "/dashboard/students?view=students", label: "Students", value: "students" },
  { href: "/dashboard/students?view=families", label: "Families", value: "families" },
  { href: "/dashboard/students?view=add", label: "Add Student", value: "add" },
] as const;

interface StudentsPageContentProps {
  searchParams: Promise<{ view?: string }>;
}

export async function StudentsPageContent({ searchParams }: StudentsPageContentProps) {
  const { view: rawView } = await searchParams;
  const validViews = new Set(STUDENT_TABS.map((tab) => tab.value));
  const view = rawView && validViews.has(rawView as (typeof STUDENT_TABS)[number]["value"])
    ? rawView
    : "students";

  const [students, families, stats, schools, schoolYears] = await Promise.all([
    getStudents(),
    getFamilies(),
    getStudentStats(),
    getSchools(),
    getSchoolYears(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Student Success (SSIS)"
        subtitle="Unified profiles from acceptance through graduation — attendance, growth, funding, and family engagement"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Students" value={formatCount(stats.total)} description="All student records" accent="indigo" icon={<span className="text-lg font-bold">S</span>} />
        <StatCard title="Enrolled" value={formatCount(stats.enrolled)} description="Enrolled students" accent="emerald" icon={<span className="text-lg font-bold">E</span>} />
        <StatCard title="Pending" value={formatCount(stats.pending)} description="Pending enrollment" accent="amber" icon={<span className="text-lg font-bold">P</span>} />
        <StatCard title="Families" value={formatCount(families.length)} description="Registered families" accent="sky" icon={<span className="text-lg font-bold">F</span>} />
      </div>

      <ViewTabs tabs={[...STUDENT_TABS]} activeView={view} />

      {view === "students" && (
        <FundingBreakdown
          title="Funding Report"
          byFunding={stats.byFunding}
          byCategory={stats.byCategory}
        />
      )}

      {view === "families" ? (
        <FamilyList families={families} />
      ) : view === "add" ? (
        <StudentForm schools={schools} families={families} schoolYears={schoolYears} />
      ) : (
        <StudentList students={students} />
      )}
    </div>
  );
}

export function StudentsPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-slate-200" />
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
