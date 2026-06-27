import { StatCard } from "@/components/dashboard/StatCard";
import { QuickLaunchGrid } from "@/components/dashboard/QuickLaunchGrid";
import { getSessionUser } from "@/lib/auth/session";
import {
  formatCount,
  formatCurrency,
  getDashboardMetrics,
} from "@/lib/dashboard/metrics";

export default async function ExecutiveHomePage() {
  const [sessionUser, metrics] = await Promise.all([
    getSessionUser(),
    getDashboardMetrics(),
  ]);

  const greeting = getGreeting();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-brand-900 via-brand-700 to-indigo-600 p-6 text-white shadow-lg sm:p-8">
        <p className="text-sm font-medium text-indigo-100">{greeting}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome back, {sessionUser?.fullName ?? "Executive"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-indigo-100/90 sm:text-base">
          Your AcademyOS executive command center — monitor enrollment, admissions,
          scholarships, and organizational health at a glance.
        </p>
        <a
          href="/dashboard/executive"
          className="mt-4 inline-flex rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/25 hover:bg-white/20"
        >
          Open Executive Intelligence →
        </a>
        {sessionUser?.roleLabel && (
          <p className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100 ring-1 ring-white/20">
            {sessionUser.roleLabel}
          </p>
        )}
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Key Metrics</h2>
          <p className="mt-1 text-sm text-slate-500">
            Live data from your organization
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Enrollment"
            value={formatCount(metrics.enrollment)}
            description="Active course section enrollments"
            accent="indigo"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                <path
                  d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
                <path
                  d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
              </svg>
            }
          />
          <StatCard
            title="Active Students"
            value={formatCount(metrics.activeStudents)}
            description="Students with active status"
            accent="emerald"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                <path
                  d="M22 10v6M2 10l10-5 10 5-10 5z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
              </svg>
            }
          />
          <StatCard
            title="Admissions Pipeline"
            value={formatCount(metrics.admissionsPipeline)}
            description="Leads in active admissions stages"
            accent="sky"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                <path
                  d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.75" />
                <path
                  d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <StatCard
            title="Scholarships Awarded"
            value={formatCount(metrics.scholarshipsAwarded)}
            description="Approved scholarship applications"
            accent="amber"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <StatCard
            title="Employees"
            value={formatCount(metrics.employees)}
            description="Staff with active employment status"
            accent="violet"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                <rect
                  x="2"
                  y="7"
                  width="20"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <path
                  d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
              </svg>
            }
          />
          <StatCard
            title="Revenue"
            value={formatCurrency(metrics.revenue)}
            description="Total payments collected"
            accent="rose"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                <path
                  d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
        </div>
      </section>

      <QuickLaunchGrid />
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
