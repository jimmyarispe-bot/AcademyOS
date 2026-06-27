import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReadinessSnapshotPanel } from "@/components/instruction/ReadinessSnapshotPanel";
import { EvidenceLibraryFilters } from "@/components/instruction/EvidenceLibraryFilters";
import { ProgressVisualizationPanel } from "@/components/instruction/ProgressVisualizationPanel";
import {
  GrowthGoalProgressForm,
  InterventionEffectivenessForm,
  MeetingDocumentationForm,
  MeetingScheduleForm,
  NewGrowthGoalForm,
  TeamMemberForm,
} from "@/components/instruction/InstructionForms";
import { getStudentById } from "@/lib/students/queries";
import { getStudentInstructionalTeam, getStudentGrowthPlan } from "@/lib/instruction/growth-plan";
import { getStudentCollaborationFeed } from "@/lib/instruction/feed";
import { getStudentReadinessSnapshot } from "@/lib/instruction/readiness";
import { searchEvidenceLibrary, getProgressVisualizationData } from "@/lib/instruction/evidence";
import { getInterventionEffectivenessReport } from "@/lib/instruction/effectiveness";
import { getStudentMeetings } from "@/lib/instruction/meetings";
import { createAuthClient } from "@/lib/supabase/server-auth";

interface StudentCollaborationPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    view?: string;
    q?: string;
    artifact_type?: string;
    subject_domain?: string;
    goal_id?: string;
    date_from?: string;
    date_to?: string;
  }>;
}

const VIEWS = ["overview", "growth", "team", "feed", "evidence", "meetings", "progress"] as const;

export default async function StudentCollaborationPage({ params, searchParams }: StudentCollaborationPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const view = VIEWS.includes(sp.view as (typeof VIEWS)[number]) ? sp.view : "overview";

  const student = await getStudentById(id);
  if (!student) notFound();

  const supabase = await createAuthClient();
  const { data: schoolStaff } = await supabase
    .from("employees")
    .select("id, employee_profiles(display_name)")
    .eq("school_id", student.school_id)
    .eq("employment_status", "active")
    .order("created_at");

  const employees = (schoolStaff ?? []).map((e) => {
    const profile = Array.isArray(e.employee_profiles) ? e.employee_profiles[0] : e.employee_profiles;
    return {
      id: e.id,
      name: (profile as { display_name?: string })?.display_name ?? e.id.slice(0, 8),
    };
  });

  const [readiness, team, goals, feed, meetings, progressData, effectiveness] = await Promise.all([
    getStudentReadinessSnapshot(supabase, id),
    getStudentInstructionalTeam(supabase, id),
    getStudentGrowthPlan(supabase, id),
    getStudentCollaborationFeed(supabase, id),
    getStudentMeetings(supabase, id),
    getProgressVisualizationData(supabase, id),
    getInterventionEffectivenessReport(supabase, id),
  ]);

  const evidence = await searchEvidenceLibrary(supabase, {
    studentId: id,
    query: sp.q,
    artifactType: sp.artifact_type,
    subjectDomain: sp.subject_domain,
    goalId: sp.goal_id,
    dateFrom: sp.date_from,
    dateTo: sp.date_to,
  });

  const goalOptions = goals.map((g) => ({ id: g.id, title: g.title }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/dashboard/teacher" className="text-sm text-slate-500 hover:text-brand-600">← Teacher Workspace</Link>
      <PageHeader
        title={`${student.first_name} ${student.last_name}`}
        subtitle="Collaborative instruction & Student Growth Plan"
      />

      <nav className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={`/dashboard/teacher/students/${id}?view=${v}`}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${view === v ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {v.replace(/-/g, " ")}
          </Link>
        ))}
        <Link href={`/dashboard/students/${id}`} className="rounded-lg px-3 py-1.5 text-sm text-brand-600">SSIS profile →</Link>
      </nav>

      {view === "overview" && <ReadinessSnapshotPanel snapshot={readiness} />}

      {view === "growth" && (
        <div className="space-y-6">
          <article className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">{goals.length} goals across all sources</p>
            <p className="mt-1">
              Average progress:{" "}
              {goals.length
                ? Math.round(goals.reduce((s, g) => s + Number(g.progress_pct ?? 0), 0) / goals.length)
                : 0}
              %
            </p>
          </article>
          <NewGrowthGoalForm studentId={id} />
          <div className="space-y-4">
            {goals.map((g) => {
              const emp = Array.isArray(g.employees) ? g.employees[0] : g.employees;
              const profile = emp?.employee_profiles;
              const prof = Array.isArray(profile) ? profile[0] : profile;
              const evidenceList = Array.isArray(g.evidence) ? g.evidence : [];
              return (
                <article key={g.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="text-xs uppercase text-slate-400">{g.goal_source}</span>
                      <h3 className="font-medium text-slate-900">{g.title}</h3>
                      <p className="text-sm text-slate-600">{g.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Baseline: {g.baseline ?? "—"} → Target: {g.target ?? "—"}
                      </p>
                      {g.success_criteria && (
                        <p className="mt-1 text-xs text-slate-500">Success criteria: {g.success_criteria}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        Assigned: {(prof as { display_name?: string })?.display_name ?? "—"}
                        {g.review_date ? ` · Review: ${g.review_date}` : ""}
                      </p>
                      {evidenceList.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">{evidenceList.length} evidence item(s) on file</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-brand-600">{g.progress_pct}%</p>
                      <p className="text-xs capitalize text-slate-500">{g.status}</p>
                    </div>
                  </div>
                  <GrowthGoalProgressForm goalId={g.id} studentId={id} />
                </article>
              );
            })}
          </div>
        </div>
      )}

      {view === "team" && (
        <div className="space-y-6">
          <TeamMemberForm studentId={id} employees={employees} />
          <div className="space-y-3">
            {(team.members ?? []).map((m) => {
              const emp = Array.isArray(m.employees) ? m.employees[0] : m.employees;
              const profile = emp?.employee_profiles;
              const prof = Array.isArray(profile) ? profile[0] : profile;
              return (
                <article key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="font-medium capitalize text-slate-900">{(prof as { display_name?: string })?.display_name ?? "Staff"}</p>
                    <p className="text-sm capitalize text-slate-500">{m.team_role.replace(/_/g, " ")}</p>
                    {m.notes && <p className="mt-1 text-xs text-slate-400">{m.notes}</p>}
                  </div>
                  {m.is_primary && <span className="text-xs text-brand-600">Primary</span>}
                </article>
              );
            })}
            {!team.members?.length && (
              <p className="text-sm text-slate-500">No team members yet. Team auto-syncs from enrollments and assignments.</p>
            )}
          </div>
        </div>
      )}

      {view === "feed" && (
        <div className="space-y-3">
          {feed.map((ev) => (
            <article key={ev.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400">{new Date(ev.occurred_at).toLocaleString()}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] capitalize text-slate-500">{ev.classification}</span>
              </div>
              <h3 className="font-medium text-slate-900">{ev.title}</h3>
              {ev.body && <p className="text-sm text-slate-600">{ev.body}</p>}
            </article>
          ))}
          {!feed.length && <p className="text-sm text-slate-500">No collaboration activity yet.</p>}
        </div>
      )}

      {view === "evidence" && (
        <div className="space-y-4">
          <Suspense fallback={null}>
            <EvidenceLibraryFilters basePath={`/dashboard/teacher/students/${id}`} goals={goalOptions} />
          </Suspense>
          <div className="grid gap-3 sm:grid-cols-2">
            {evidence.map((a) => (
              <article key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-medium">{a.title}</h3>
                <p className="text-sm capitalize text-slate-500">{a.artifact_type.replace(/_/g, " ")}</p>
                {a.subject_domain && <p className="text-xs text-slate-400 capitalize">{a.subject_domain.replace(/_/g, " ")}</p>}
                <p className="mt-1 text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString()}</p>
              </article>
            ))}
            {!evidence.length && <p className="text-sm text-slate-500 sm:col-span-2">No evidence matches these filters.</p>}
          </div>
        </div>
      )}

      {view === "meetings" && (
        <div className="space-y-6">
          <MeetingScheduleForm studentId={id} />
          {meetings.map((m) => (
            <article key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-medium">{m.title}</h3>
              <p className="text-sm capitalize text-slate-500">
                {m.meeting_type.replace(/_/g, " ")} · {m.status}
                {m.scheduled_at ? ` · ${new Date(m.scheduled_at).toLocaleString()}` : ""}
              </p>
              {m.agenda && <p className="mt-2 text-sm text-slate-600">{m.agenda}</p>}
              {m.notes && <p className="mt-2 text-sm text-slate-600"><span className="font-medium">Notes:</span> {m.notes}</p>}
              {m.decisions && <p className="mt-1 text-sm text-slate-600"><span className="font-medium">Decisions:</span> {m.decisions}</p>}
              {m.status === "scheduled" && (
                <MeetingDocumentationForm meetingId={m.id} studentId={id} />
              )}
            </article>
          ))}
        </div>
      )}

      {view === "progress" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Intervention effectiveness</h3>
            {effectiveness.map((r) => (
              <div key={r.intervention.id} className="mt-4 border-t border-slate-100 pt-4">
                <p className="font-medium">{r.intervention.intervention_type}</p>
                <p className="text-sm text-slate-500">
                  {r.totalMinutes} min · Rating: {r.latestRating} · Trend: {r.latestTrend}
                  {r.intervention.start_date ? ` · Started ${r.intervention.start_date}` : ""}
                </p>
                <InterventionEffectivenessForm interventionId={r.intervention.id} studentId={id} />
              </div>
            ))}
            {!effectiveness.length && <p className="mt-2 text-sm text-slate-500">No interventions on file.</p>}
          </section>
          <ProgressVisualizationPanel
            academicProgress={progressData.academicProgress}
            structuredLiteracy={progressData.structuredLiteracy}
            attendance={progressData.attendance}
            goals={progressData.goals}
            interventionEffectiveness={progressData.interventionEffectiveness}
          />
        </div>
      )}
    </div>
  );
}
