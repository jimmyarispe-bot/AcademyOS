"use client";

import { useState, useTransition } from "react";
import {
  assignInterventionAction,
  recordProgressAction,
  recordSessionAssessmentAction,
  recordStructuredLiteracyAction,
  registerArtifactAction,
  saveLessonPlanAction,
  saveTeacherNoteAction,
  sendParentMessageAction,
  takeSessionAttendanceAction,
  updateSessionStudentRecordAction,
} from "@/lib/teacher/actions";

function linesToJsonArray(text: string): string {
  return JSON.stringify(
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
  );
}

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const btnPrimary = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50";
const btnSecondary = "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

type StudentOption = { id: string; first_name?: string; last_name?: string };

export function TeacherNoteForm({ students }: { students: StudentOption[] }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const fd = new FormData(e.currentTarget);
          const r = await saveTeacherNoteAction(fd);
          setMsg("error" in r && r.error ? r.error : "Note saved");
        });
      }}
    >
      <h3 className="font-semibold text-slate-900">New instructional note</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-500">Category</label>
          <select name="category" className={inputClass} required>
            <option value="academic">Academic</option>
            <option value="behavior">Behavior</option>
            <option value="parent_communication">Parent communication</option>
            <option value="intervention">Intervention</option>
            <option value="observation">Observation</option>
            <option value="planning">Planning</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Student (optional)</label>
          <select name="student_id" className={inputClass}>
            <option value="">—</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
            ))}
          </select>
        </div>
      </div>
      <input name="title" placeholder="Title" className={inputClass} required />
      <textarea name="body" placeholder="Note body" rows={3} className={inputClass} required />
      <input name="tags" placeholder="Tags (comma-separated)" className={inputClass} />
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save note"}</button>
      {msg && <p className="text-xs text-slate-600">{msg}</p>}
    </form>
  );
}

export function ParentMessageForm({ students }: { students: StudentOption[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await sendParentMessageAction(new FormData(e.currentTarget));
        });
      }}
    >
      <h3 className="font-semibold text-slate-900">Parent communication</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-500">Student</label>
          <select name="student_id" className={inputClass} required>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Type</label>
          <select name="message_type" className={inputClass}>
            <option value="message">Message</option>
            <option value="progress_update">Progress update</option>
            <option value="conference_request">Conference request</option>
            <option value="meeting_schedule">Schedule meeting</option>
            <option value="artifact_share">Share artifact</option>
          </select>
        </div>
      </div>
      <input name="subject" placeholder="Subject" className={inputClass} required />
      <textarea name="body" placeholder="Message" rows={4} className={inputClass} required />
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Sending…" : "Send & log to timeline"}</button>
    </form>
  );
}

export function InterventionForm({ students }: { students: StudentOption[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await assignInterventionAction(new FormData(e.currentTarget));
        });
      }}
    >
      <h3 className="font-semibold text-slate-900">Assign intervention</h3>
      <select name="student_id" className={inputClass} required>
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
        ))}
      </select>
      <select name="intervention_category" className={inputClass}>
        <option value="reading">Reading</option>
        <option value="math">Math</option>
        <option value="writing">Writing</option>
        <option value="behavior">Behavior</option>
        <option value="executive_functioning">Executive functioning</option>
        <option value="attendance">Attendance</option>
        <option value="social_emotional">Social-emotional</option>
      </select>
      <input name="intervention_type" placeholder="Intervention name" className={inputClass} required />
      <input name="goal_text" placeholder="Goal" className={inputClass} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="frequency" placeholder="Frequency" className={inputClass} />
        <input name="duration_weeks" type="number" placeholder="Weeks" className={inputClass} />
        <input name="review_date" type="date" className={inputClass} />
      </div>
      <textarea name="notes" placeholder="Notes" rows={2} className={inputClass} />
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Assigning…" : "Assign intervention"}</button>
    </form>
  );
}

export function LessonPlanForm() {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const fd = new FormData(e.currentTarget);
          fd.set("objectives", linesToJsonArray(fd.get("objectives_text") as string));
          fd.set("materials", linesToJsonArray(fd.get("materials_text") as string));
          fd.set("activities", linesToJsonArray(fd.get("activities_text") as string));
          await saveLessonPlanAction(fd);
        });
      }}
    >
      <h3 className="font-semibold text-slate-900">Create reusable lesson plan</h3>
      <input name="title" placeholder="Plan title" className={inputClass} required />
      <select name="subject_domain" className={inputClass}>
        <option value="reading">Reading</option>
        <option value="writing">Writing</option>
        <option value="math">Math</option>
        <option value="structured_literacy">Structured Literacy</option>
        <option value="other">Other</option>
      </select>
      <textarea name="objectives_text" placeholder="Objectives (one per line)" rows={2} className={inputClass} />
      <textarea name="materials_text" placeholder="Materials (one per line)" rows={2} className={inputClass} />
      <textarea name="activities_text" placeholder="Activities (one per line)" rows={2} className={inputClass} />
      <textarea name="differentiation" placeholder="Differentiation" rows={2} className={inputClass} />
      <textarea name="accommodations" placeholder="Accommodations" rows={2} className={inputClass} />
      <input name="homework" placeholder="Homework" className={inputClass} />
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Publish lesson plan"}</button>
    </form>
  );
}

export function ProgressRecordForm({ students, sessionId }: { students: StudentOption[]; sessionId?: string }) {
  const [pending, startTransition] = useTransition();
  const [recommendation, setRecommendation] = useState<string | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const fd = new FormData(e.currentTarget);
            if (sessionId) fd.set("session_id", sessionId);
            await recordProgressAction(fd);
          });
        }}
      >
        <h3 className="font-semibold text-slate-900">Academic progress</h3>
        <select name="student_id" className={inputClass} required>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
          ))}
        </select>
        <select name="domain" className={inputClass}>
          <option value="reading">Reading (levels 1–3)</option>
          <option value="writing">Writing (levels 1–3)</option>
          <option value="math">Mathematics (levels 1–3)</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input name="current_level" type="number" min={1} max={3} placeholder="Current level" className={inputClass} required />
          <input name="previous_level" type="number" min={1} max={3} placeholder="Previous level" className={inputClass} />
        </div>
        <textarea name="teacher_notes" placeholder="Teacher notes" rows={2} className={inputClass} />
        <button type="submit" disabled={pending} className={btnPrimary}>Record progress</button>
      </form>

      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const fd = new FormData(e.currentTarget);
            if (sessionId) fd.set("session_id", sessionId);
            const r = await recordStructuredLiteracyAction(fd);
            if ("recommendation" in r && r.recommendation) setRecommendation(r.recommendation);
          });
        }}
      >
        <h3 className="font-semibold text-slate-900">Structured Literacy</h3>
        <select name="student_id" className={inputClass} required>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input name="literacy_level" type="number" min={1} max={5} placeholder="Level" className={inputClass} required />
          <input name="literacy_step" type="number" min={1} max={10} placeholder="Step" className={inputClass} required />
        </div>
        <input name="instructional_minutes" type="number" placeholder="Minutes" className={inputClass} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="mastery_recorded" value="true" />
          Mastery recorded — suggest next step
        </label>
        <textarea name="teacher_notes" placeholder="Notes" rows={2} className={inputClass} />
        <button type="submit" disabled={pending} className={btnPrimary}>Record SL progress</button>
        {recommendation && <p className="text-sm text-brand-600">{recommendation}</p>}
      </form>
    </div>
  );
}

export function SessionAssessmentForm({
  sessionId,
  students,
}: {
  sessionId: string;
  students: StudentOption[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const fd = new FormData(e.currentTarget);
          fd.set("session_id", sessionId);
          await recordSessionAssessmentAction(fd);
        });
      }}
    >
      <h3 className="font-semibold text-slate-900">Record assessment</h3>
      <select name="student_id" className={inputClass} required>
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
        ))}
      </select>
      <select name="assessment_type" className={inputClass}>
        <option value="quick_check">Quick check</option>
        <option value="benchmark">Benchmark</option>
        <option value="map">MAP</option>
        <option value="teacher_created">Teacher-created</option>
        <option value="rubric">Rubric</option>
        <option value="mastery">Mastery</option>
      </select>
      <input name="title" placeholder="Assessment title" className={inputClass} required />
      <input name="score" placeholder="Score / result" className={inputClass} />
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save to Academic Growth Center"}</button>
    </form>
  );
}

export function ArtifactForm({ sessionId, students }: { sessionId?: string; students: StudentOption[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const fd = new FormData(e.currentTarget);
          if (sessionId) fd.set("session_id", sessionId);
          const studentId = fd.get("student_id") as string;
          const title = fd.get("title") as string;
          if (!fd.get("storage_path")) {
            fd.set("storage_path", `artifacts/${studentId}/${Date.now()}-${title.replace(/\s+/g, "-").toLowerCase()}`);
          }
          await registerArtifactAction(fd);
        });
      }}
    >
      <h3 className="font-semibold text-slate-900">Register artifact</h3>
      <select name="student_id" className={inputClass} required>
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
        ))}
      </select>
      <select name="artifact_type" className={inputClass}>
        <option value="photo">Photo</option>
        <option value="pdf">PDF</option>
        <option value="audio">Audio</option>
        <option value="video">Video</option>
        <option value="assessment">Assessment</option>
        <option value="observation_note">Observation note</option>
        <option value="work_sample">Work sample</option>
        <option value="writing_sample">Writing sample</option>
        <option value="reading_recording">Reading recording</option>
        <option value="math_work">Math work</option>
        <option value="other">Other</option>
      </select>
      <select name="subject_domain" className={inputClass}>
        <option value="">Subject (optional)</option>
        <option value="reading">Reading</option>
        <option value="writing">Writing</option>
        <option value="math">Math</option>
        <option value="structured_literacy">Structured literacy</option>
      </select>
      <input name="title" placeholder="Title" className={inputClass} required />
      <input name="file_name" placeholder="File name" className={inputClass} />
      <input name="learning_objective" placeholder="Learning objective" className={inputClass} />
      <textarea name="description" placeholder="Description" rows={2} className={inputClass} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="visible_to_parent" value="true" />
        Visible on Parent Portal
      </label>
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Register artifact"}</button>
    </form>
  );
}

export function SessionStudentPanel({
  sessionId,
  studentId,
  studentName,
  attendanceStatus,
  record,
}: {
  sessionId: string;
  studentId: string;
  studentName: string;
  attendanceStatus: string;
  record?: {
    participation_level?: string | null;
    behavior_observation?: string | null;
    session_notes?: string | null;
  } | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="font-medium text-slate-900">{studentName}</h4>
      <p className="text-xs capitalize text-slate-500">Attendance: {attendanceStatus.replace(/_/g, " ")}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["present", "virtual_present", "tardy", "absent_excused", "absent_unexcused"] as const).map((status) => (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("session_id", sessionId);
                fd.set("student_id", studentId);
                fd.set("status", status);
                await takeSessionAttendanceAction(fd);
              });
            }}
            className={btnSecondary + " !px-2 !py-1 !text-xs capitalize"}
          >
            {status.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const fd = new FormData(e.currentTarget);
            fd.set("session_id", sessionId);
            fd.set("student_id", studentId);
            await updateSessionStudentRecordAction(fd);
          });
        }}
      >
        <select name="participation_level" defaultValue={record?.participation_level ?? ""} className={inputClass}>
          <option value="">Participation…</option>
          <option value="active">Active</option>
          <option value="moderate">Moderate</option>
          <option value="minimal">Minimal</option>
          <option value="absent">Absent</option>
        </select>
        <textarea
          name="behavior_observation"
          defaultValue={record?.behavior_observation ?? ""}
          placeholder="Behavior observation"
          rows={2}
          className={inputClass}
        />
        <textarea
          name="student_session_notes"
          defaultValue={record?.session_notes ?? ""}
          placeholder="Session notes for this student"
          rows={2}
          className={inputClass}
        />
        <button type="submit" disabled={pending} className={btnSecondary + " !py-1.5"}>
          Save student record
        </button>
      </form>
    </article>
  );
}
