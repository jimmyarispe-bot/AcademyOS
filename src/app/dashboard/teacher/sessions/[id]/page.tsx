import Link from "next/link";
import { ReadinessSnapshotPanel } from "@/components/instruction/ReadinessSnapshotPanel";
import { SessionOutcomeForm } from "@/components/instruction/InstructionForms";
import {
  ArtifactForm,
  SessionAssessmentForm,
  SessionStudentPanel,
  TeacherNoteForm,
} from "@/components/teacher/TeacherWorkspaceForms";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SessionWorkspaceForm } from "@/components/teacher/SessionWorkspaceForm";
import { formatAcademyTime } from "@/lib/scheduling/academy-way";
import { getStudentReadinessSnapshot } from "@/lib/instruction/readiness";
import { getSessionOutcomes } from "@/lib/instruction/outcomes";
import { getSessionWorkspace, getTeacherEmployeeId, getTeacherRosterStudents } from "@/lib/teacher/queries";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";

interface SessionWorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionWorkspacePage({ params }: SessionWorkspacePageProps) {
  const { id } = await params;
  const supabase = await createAuthClient();
  const workspace = await getSessionWorkspace(supabase, id);

  if (!workspace) notFound();

  const ctx = await getIdentityContext();
  const employeeId = ctx ? await getTeacherEmployeeId(supabase, ctx.effectiveUserId) : null;
  const rosterStudents = employeeId ? await getTeacherRosterStudents(supabase, employeeId) : [];

  const { session, students, attendance, delivery, assessments, artifacts, studentRecords } = workspace;
  const cs = Array.isArray(session.course_sections) ? session.course_sections[0] : session.course_sections;
  const course = Array.isArray(cs?.courses) ? cs.courses[0] : cs?.courses;

  const attendanceMap = new Map((attendance ?? []).map((a) => [a.student_id, a.attendance_status]));
  const recordMap = new Map((studentRecords ?? []).map((r) => [r.student_id, r]));

  const sessionStudents = (students ?? []).map((e) => {
    const st = Array.isArray(e.students) ? e.students[0] : e.students;
    return {
      id: e.student_id,
      first_name: (st as { first_name?: string })?.first_name,
      last_name: (st as { last_name?: string })?.last_name,
    };
  });

  const readinessSnapshots = await Promise.all(
    sessionStudents.map(async (st) => ({
      student: st,
      snapshot: await getStudentReadinessSnapshot(supabase, st.id),
    }))
  );

  const outcomes = await getSessionOutcomes(supabase, id);

  const deliveryData = delivery as {
    session_notes?: string | null;
    homework?: string | null;
    lesson_objectives?: unknown;
    standards?: string[] | null;
    learning_targets?: unknown;
    activities?: unknown;
    lesson_status?: string;
  } | null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/dashboard/teacher" className="hover:text-brand-600">
          ← Teacher Workspace
        </Link>
      </div>

      <PageHeader
        title={(course as { name?: string })?.name ?? "Instructional Session"}
        subtitle={`${(cs as { section_code?: string })?.section_code ?? ""} · ${formatAcademyTime(session.scheduled_start)} – ${formatAcademyTime(session.scheduled_end)} · ${deliveryData?.lesson_status?.replace(/_/g, " ") ?? "not started"}`}
      />

      {session.meet_link && (
        <a
          href={session.meet_link}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border border-brand-200 bg-brand-50 p-4 text-center text-sm font-medium text-brand-700 hover:bg-brand-100"
        >
          Join Google Meet
        </a>
      )}

      {sessionStudents.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-semibold text-slate-900">Pre-session readiness</h2>
          {readinessSnapshots.map(({ student, snapshot }) => (
            <div key={student.id}>
              <p className="mb-2 text-sm font-medium text-slate-700">
                {student.first_name} {student.last_name}
                <Link href={`/dashboard/teacher/students/${student.id}`} className="ml-2 text-brand-600 hover:underline">
                  Growth plan →
                </Link>
              </p>
              <ReadinessSnapshotPanel snapshot={snapshot} />
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Lesson plan & session notes</h2>
        <div className="mt-4">
          <SessionWorkspaceForm sessionId={id} delivery={deliveryData} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Students — attendance, participation & behavior</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {sessionStudents.map((st) => (
            <SessionStudentPanel
              key={st.id}
              sessionId={id}
              studentId={st.id}
              studentName={`${st.first_name ?? ""} ${st.last_name ?? ""}`.trim()}
              attendanceStatus={attendanceMap.get(st.id) ?? "pending"}
              record={recordMap.get(st.id)}
            />
          ))}
          {!sessionStudents.length && (
            <p className="text-sm text-slate-500">No students enrolled in this section.</p>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section id="assessments">
          <SessionAssessmentForm sessionId={id} students={sessionStudents.length ? sessionStudents : rosterStudents as typeof sessionStudents} />
          <ul className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            {assessments.map((a) => (
              <li key={a.id}>{a.title} — {a.score ?? "—"} ({a.assessment_type})</li>
            ))}
          </ul>
        </section>

        <section id="artifacts">
          <ArtifactForm
            sessionId={id}
            students={sessionStudents.length ? sessionStudents : rosterStudents as typeof sessionStudents}
          />
          <ul className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            {artifacts.map((a) => (
              <li key={a.id}>
                {a.title}
                {a.visible_to_parent ? " · Parent Portal" : ""}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {sessionStudents.map((st) => (
        <section key={st.id} id="outcomes">
          <SessionOutcomeForm sessionId={id} studentId={st.id} />
        </section>
      ))}

      {outcomes.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <h3 className="font-medium text-slate-900">Recorded outcomes</h3>
          <ul className="mt-2 space-y-1">
            {outcomes.map((o) => (
              <li key={o.id}>Mastery: {o.mastery_level ?? "—"} · {o.recommended_next_steps ?? "Documented"}</li>
            ))}
          </ul>
        </section>
      )}

      <section id="notes">
        <TeacherNoteForm students={sessionStudents.length ? sessionStudents : rosterStudents as typeof sessionStudents} />
      </section>
    </div>
  );
}
